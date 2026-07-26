import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { Readable } from 'stream';
import crypto from 'crypto';

const ddbMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);
const lambdaMock = mockClient(LambdaClient);

function readableFromString(text) {
  const stream = new Readable();
  stream.push(text);
  stream.push(null);
  return stream;
}

// getSignedUrlはネットワークアクセスせずローカルでSigV4署名を計算するだけなので、
// モックせず実物を使い、生成されたURLの構造（バケット・キー・ファイル名エンコード等）を検証する

// @sparticuz/chromium・puppeteer-coreはESM専用パッケージのため、
// efudaPdfHandler.js側では動的import()で読み込んでいる（vi.mockは標準的なESM形状でよい）
const launchMock = vi.fn();
vi.mock('puppeteer-core', () => ({
  default: {
    launch: (...args) => launchMock(...args),
    defaultArgs: vi.fn().mockResolvedValue(['--fake-arg']),
  },
}));
vi.mock('@sparticuz/chromium', () => ({
  default: {
    args: ['--chromium-arg'],
    executablePath: vi.fn().mockResolvedValue('/opt/mock-chromium/chromium'),
  },
}));

vi.spyOn(crypto, 'randomUUID').mockReturnValue('mock-job-id');
vi.spyOn(console, 'error').mockImplementation(() => {});

const { generateEfudaPdf, renderEfudaPdfWorker, getEfudaPdfStatus } = await import('./efudaPdfHandler');

process.env.TABLE_NAME = 'TestTable';
process.env.EFUDA_PDF_BUCKET_NAME = 'test-efuda-pdf-bucket';
process.env.RENDER_WORKER_FUNCTION_NAME = 'arn:aws:lambda:ap-northeast-1:123456789012:function:renderEfudaPdfWorker';
// getSignedUrlはSigV4署名の計算にAWS認証情報を必要とする（実際に外部へ通信はしない）。
// CI環境にはAWS認証情報が設定されていないため、ダミーの値を明示的に与えないと
// 「Could not load credentials」で例外になってしまう
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'test-access-key-id';
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'test-secret-access-key';

describe('generateEfudaPdf', () => {
  beforeEach(() => {
    ddbMock.reset();
    lambdaMock.reset();
  });

  it('rejects invalid input (missing categories or invalid side)', async () => {
    const response = await generateEfudaPdf({ body: JSON.stringify({ categoryParam: '', side: 'front' }) });
    expect(response.statusCode).toBe(400);

    const response2 = await generateEfudaPdf({ body: JSON.stringify({ categoryParam: 'Cat1', side: 'sideways' }) });
    expect(response2.statusCode).toBe(400);
  });

  it('sums per-category counts from DynamoDB, invokes the worker asynchronously, and returns a jobId', async () => {
    ddbMock.on(QueryCommand, { ExpressionAttributeValues: { ':cat': 'Cat1' } }).resolves({ Count: 3 });
    ddbMock.on(QueryCommand, { ExpressionAttributeValues: { ':cat': 'Cat2' } }).resolves({ Count: 5 });
    lambdaMock.on(InvokeCommand).resolves({ StatusCode: 202 });

    const response = await generateEfudaPdf({ body: JSON.stringify({ categoryParam: 'Cat1,Cat2', side: 'back' }) });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({ jobId: 'mock-job-id' });

    const invokeCall = lambdaMock.commandCalls(InvokeCommand)[0].args[0].input;
    expect(invokeCall.InvocationType).toBe('Event');
    expect(invokeCall.FunctionName).toBe(process.env.RENDER_WORKER_FUNCTION_NAME);
    expect(JSON.parse(invokeCall.Payload)).toEqual({ jobId: 'mock-job-id', categoryParam: 'Cat1,Cat2', side: 'back' });
  });

  it('rejects when the total card count exceeds the server-side cap without invoking the worker', async () => {
    ddbMock.on(QueryCommand, { ExpressionAttributeValues: { ':cat': 'HugeCat' } }).resolves({ Count: 9999 });

    const response = await generateEfudaPdf({ body: JSON.stringify({ categoryParam: 'HugeCat', side: 'front' }) });

    expect(response.statusCode).toBe(400);
    expect(lambdaMock.commandCalls(InvokeCommand)).toHaveLength(0);
  });

  it('handles errors', async () => {
    ddbMock.on(QueryCommand).rejects(new Error('DynamoDB error'));
    const response = await generateEfudaPdf({ body: JSON.stringify({ categoryParam: 'Cat1', side: 'front' }) });
    expect(response.statusCode).toBe(500);
  });

  it('treats a missing Count from DynamoDB as 0 cards for that category', async () => {
    ddbMock.on(QueryCommand, { ExpressionAttributeValues: { ':cat': 'Cat1' } }).resolves({});
    lambdaMock.on(InvokeCommand).resolves({ StatusCode: 202 });

    const response = await generateEfudaPdf({ body: JSON.stringify({ categoryParam: 'Cat1', side: 'front' }) });

    expect(response.statusCode).toBe(200);
  });

  it('treats a missing request body as an empty object instead of throwing', async () => {
    const response = await generateEfudaPdf({});
    expect(response.statusCode).toBe(400);
  });
});

describe('renderEfudaPdfWorker', () => {
  let pageMock;
  let browserMock;

  beforeEach(() => {
    s3Mock.reset();
    launchMock.mockReset();

    pageMock = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(undefined),
      emulateMediaType: vi.fn().mockResolvedValue(undefined),
      pdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-fake')),
    };
    browserMock = {
      newPage: vi.fn().mockResolvedValue(pageMock),
      close: vi.fn().mockResolvedValue(undefined),
    };
    launchMock.mockResolvedValue(browserMock);
  });

  it('navigates to the print view with the expected query params and uploads the resulting PDF to S3', async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    await renderEfudaPdfWorker({ jobId: 'job-1', categoryParam: 'Cat1,Cat2', side: 'back' });

    const gotoUrl = new URL(pageMock.goto.mock.calls[0][0]);
    expect(gotoUrl.origin + gotoUrl.pathname).toBe('https://bamiyanapp.github.io/karuta/');
    expect(gotoUrl.searchParams.get('view')).toBe('print-efuda');
    expect(gotoUrl.searchParams.get('category')).toBe('Cat1,Cat2');
    expect(gotoUrl.searchParams.get('side')).toBe('back');
    expect(gotoUrl.searchParams.get('pdfExport')).toBe('1');

    expect(pageMock.emulateMediaType).toHaveBeenCalledWith('print');
    expect(pageMock.pdf).toHaveBeenCalledWith({ preferCSSPageSize: true, printBackground: true });

    const putCall = s3Mock.commandCalls(PutObjectCommand)[0].args[0].input;
    expect(putCall.Bucket).toBe('test-efuda-pdf-bucket');
    expect(putCall.Key).toBe('efuda-pdf/job-1.pdf');
    expect(putCall.ContentType).toBe('application/pdf');
    expect(browserMock.close).toHaveBeenCalled();
  });

  it('writes an error marker to S3 instead of a PDF when rendering fails, and still closes the browser', async () => {
    pageMock.pdf.mockRejectedValue(new Error('boom'));
    s3Mock.on(PutObjectCommand).resolves({});

    await renderEfudaPdfWorker({ jobId: 'job-2', categoryParam: 'Cat1', side: 'front' });

    const putCall = s3Mock.commandCalls(PutObjectCommand)[0].args[0].input;
    expect(putCall.Key).toBe('efuda-pdf/job-2.error.json');
    expect(JSON.parse(putCall.Body).message).toBe('boom');
    expect(browserMock.close).toHaveBeenCalled();
  });
});

describe('getEfudaPdfStatus', () => {
  beforeEach(() => {
    s3Mock.reset();
  });

  it('rejects when jobId is missing', async () => {
    const response = await getEfudaPdfStatus({ queryStringParameters: {} });
    expect(response.statusCode).toBe(400);
  });

  it('rejects when queryStringParameters itself is missing, instead of throwing', async () => {
    const response = await getEfudaPdfStatus({});
    expect(response.statusCode).toBe(400);
  });

  it('returns a presigned download URL (with a correctly encoded Japanese filename) when the PDF exists', async () => {
    s3Mock.on(HeadObjectCommand).resolves({});

    const response = await getEfudaPdfStatus({
      queryStringParameters: { jobId: 'job-1', categoryLabel: 'Cat1', side: 'back' },
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body.status).toBe('DONE');
    const url = new URL(body.url);
    expect(url.hostname).toContain('test-efuda-pdf-bucket');
    expect(url.pathname).toBe('/efuda-pdf/job-1.pdf');
    expect(url.searchParams.get('response-content-disposition')).toBe(
      `attachment; filename*=UTF-8''${encodeURIComponent('Cat1_絵札_裏面.pdf')}`
    );
  });

  it('returns FAILED with the stored message when only the error marker exists', async () => {
    s3Mock.on(HeadObjectCommand).rejects(Object.assign(new Error('not found'), { name: 'NotFound' }));
    s3Mock.on(GetObjectCommand).resolves({ Body: readableFromString(JSON.stringify({ message: 'render failed' })) });

    const response = await getEfudaPdfStatus({ queryStringParameters: { jobId: 'job-2' } });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({ status: 'FAILED', message: 'render failed' });
  });

  it('returns IN_PROGRESS when neither the PDF nor an error marker exist yet', async () => {
    s3Mock.on(HeadObjectCommand).rejects(Object.assign(new Error('not found'), { name: 'NotFound' }));
    s3Mock.on(GetObjectCommand).rejects(Object.assign(new Error('not found'), { name: 'NoSuchKey' }));

    const response = await getEfudaPdfStatus({ queryStringParameters: { jobId: 'job-3' } });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body).toEqual({ status: 'IN_PROGRESS' });
  });

  it('handles unexpected errors', async () => {
    s3Mock.on(HeadObjectCommand).rejects(new Error('S3 outage'));
    const response = await getEfudaPdfStatus({ queryStringParameters: { jobId: 'job-4' } });
    expect(response.statusCode).toBe(500);
  });

  it('defaults to the front-side label and "karuta" category label when side/categoryLabel are omitted', async () => {
    s3Mock.on(HeadObjectCommand).resolves({});

    const response = await getEfudaPdfStatus({ queryStringParameters: { jobId: 'job-5' } });
    const body = JSON.parse(response.body);

    expect(body.status).toBe('DONE');
    const url = new URL(body.url);
    expect(url.searchParams.get('response-content-disposition')).toBe(
      `attachment; filename*=UTF-8''${encodeURIComponent('karuta_絵札_表面.pdf')}`
    );
  });

  it('propagates an unexpected error from the error-marker lookup as a 500, instead of masking it as IN_PROGRESS', async () => {
    s3Mock.on(HeadObjectCommand).rejects(Object.assign(new Error('not found'), { name: 'NotFound' }));
    s3Mock.on(GetObjectCommand).rejects(new Error('S3 outage'));

    const response = await getEfudaPdfStatus({ queryStringParameters: { jobId: 'job-6' } });

    expect(response.statusCode).toBe(500);
  });
});
