#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { renderMermaidWithEmbed } = require("./mermaid-embed");

const repoRoot = path.resolve(__dirname, "..", "..");
const reusableCiPath = path.join(repoRoot, "dev-standards", ".github", "workflows", "reusable-ci.yml");
const karutaCiPath = path.join(repoRoot, ".github", "workflows", "ci.yml");
const karutaCdPath = path.join(repoRoot, ".github", "workflows", "cd.yml");
const outputPath = path.join(repoRoot, "docs", "generated", "cicd-architecture.md");

function loadWorkflow(filePath) {
  return yaml.load(fs.readFileSync(filePath, "utf-8"));
}

function normalizeNeeds(needs) {
  if (!needs) {
    return [];
  }
  return Array.isArray(needs) ? needs : [needs];
}

// job定義の`if:`文字列から、このjobの実行有無を左右する`inputs.<name>`参照を抽出する。
// `inputs.packages == ''`のような比較演算子つきの参照は、booleanのenable_*フラグとは
// 性質が異なる（値の比較であり単純な有効/無効ではない）ため、別枠で保持する
function extractInputConditions(ifCondition) {
  if (typeof ifCondition !== "string") {
    return [];
  }
  const matches = [...ifCondition.matchAll(/inputs\.(\w+)(\s*(?:==|!=)\s*'[^']*')?/g)];
  return matches.map((m) => ({ name: m[1], comparison: m[2] ? m[2].trim() : null }));
}

function extractJobs(workflow) {
  const jobs = workflow.jobs || {};
  return Object.entries(jobs).map(([name, def]) => ({
    name,
    needs: normalizeNeeds(def.needs),
    conditions: extractInputConditions(def.if),
  }));
}

// karutaのci.ymlの`jobs.ci.with`から、reusable-ci.ymlの各inputに実際に
// 設定されている値を得る（未設定のinputはreusable-ci.yml側のdefaultのまま）
function extractKarutaCiInputs(karutaWorkflow, reusableWorkflow) {
  const configuredWith = (karutaWorkflow.jobs.ci && karutaWorkflow.jobs.ci.with) || {};
  const inputDefs = (reusableWorkflow.on.workflow_call && reusableWorkflow.on.workflow_call.inputs) || {};
  const resolved = {};
  for (const [name, def] of Object.entries(inputDefs)) {
    resolved[name] = Object.prototype.hasOwnProperty.call(configuredWith, name) ? configuredWith[name] : def.default;
  }
  return resolved;
}

// このjobがkaruta固有の設定のもとで実際に有効かどうかを判定する。
// 単純な`inputs.enable_xxx`条件（真偽値フラグ）はkarutaCiInputsの値で判定できるが、
// `inputs.packages == ''`のような値比較条件は、resolvedInputs.packagesの実際の値と
// 比較演算子を評価して判定する
function isJobEnabledForKaruta(job, karutaCiInputs) {
  if (job.conditions.length === 0) {
    return true;
  }
  return job.conditions.every(({ name, comparison }) => {
    const value = karutaCiInputs[name];
    if (!comparison) {
      return Boolean(value);
    }
    const match = comparison.match(/(==|!=)\s*'([^']*)'/);
    if (!match) {
      return true;
    }
    const [, operator, expected] = match;
    const actual = value === undefined || value === null ? "" : String(value);
    return operator === "==" ? actual === expected : actual !== expected;
  });
}

// このファイルにはCI/CD 2つのMermaidブロックが含まれる。render-mermaid.jsの命名規則
// （1ファイル内に複数ブロックがある場合`<basename>-<出現順の連番>.png`になる）に
// 合わせ、このCIグラフが1番目（cicd-architecture-1.png）になる
function renderCiGraph(jobs, karutaCiInputs) {
  let mermaidSource = "graph TD\n";
  for (const job of jobs) {
    const enabled = isJobEnabledForKaruta(job, karutaCiInputs);
    const label = enabled ? job.name : `${job.name}（karutaでは無効/スキップ）`;
    mermaidSource += `    ${job.name}["${label}"]\n`;
    if (!enabled) {
      mermaidSource += `    style ${job.name} stroke-dasharray: 5 5\n`;
    }
  }
  mermaidSource += "\n";
  for (const job of jobs) {
    for (const need of job.needs) {
      mermaidSource += `    ${need} --> ${job.name}\n`;
    }
  }
  return renderMermaidWithEmbed({
    mermaidSource,
    imageFileName: "cicd-architecture-1.png",
    altText: "CIワークフロー構成図 (rendered)",
  });
}

// CDグラフはファイル内2番目のMermaidブロック（cicd-architecture-2.png）になる
function renderCdGraph(cdWorkflow) {
  const jobs = extractJobs(cdWorkflow);
  let mermaidSource = "graph TD\n";
  for (const job of jobs) {
    mermaidSource += `    ${job.name}["${job.name}"]\n`;
  }
  mermaidSource += "\n";
  for (const job of jobs) {
    for (const need of job.needs) {
      mermaidSource += `    ${need} --> ${job.name}\n`;
    }
  }
  return renderMermaidWithEmbed({
    mermaidSource,
    imageFileName: "cicd-architecture-2.png",
    altText: "CDワークフロー構成図 (rendered)",
  });
}

function main() {
  const reusableCiWorkflow = loadWorkflow(reusableCiPath);
  const karutaCiWorkflow = loadWorkflow(karutaCiPath);
  const karutaCdWorkflow = loadWorkflow(karutaCdPath);

  const ciJobs = extractJobs(reusableCiWorkflow);
  const karutaCiInputs = extractKarutaCiInputs(karutaCiWorkflow, reusableCiWorkflow);

  let body = "# CI/CD構成図（自動生成）\n\n";
  body +=
    "このファイルはdev-standardsの`reusable-ci.yml`のjob定義と、karuta自身の`.github/workflows/ci.yml`/" +
    "`cd.yml`から`scripts/docs/generate-cicd-architecture.js`によって自動生成される。手動で編集しない" +
    "こと。再生成するには`node scripts/docs/generate-cicd-architecture.js`を実行する" +
    "（[issue #905](https://github.com/bamiyanapp/karuta/issues/905)）。\n\n" +
    "job間の依存（`needs:`）およびkarutaの実際の設定（`ci.yml`の`with:`）に基づく" +
    "有効/無効の判定は静的解析で抽出しているが、dev-standards submoduleの参照バージョンが" +
    "更新されるとjob構成自体が変わりうる点に留意する。\n\n";
  body += "## CIワークフロー（reusable-ci.yml、karuta設定反映）\n\n";
  body += renderCiGraph(ciJobs, karutaCiInputs);
  body += "\n## CDワークフロー（karuta cd.yml）\n\n";
  body += renderCdGraph(karutaCdWorkflow);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, body, "utf-8");
  console.log(`Generated: ${path.relative(repoRoot, outputPath)} (${ciJobs.length} CI jobs)`);
}

main();
