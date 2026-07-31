# サーバレス構成図（自動生成）

このファイルは`backend/serverless.yml`のfunctions/resources定義、および各Lambda関数のコード（環境変数参照・Polly呼び出しの検出）から`scripts/docs/generate-serverless-architecture.js`によって自動生成される。手動で編集しないこと。再生成するには`node scripts/docs/generate-serverless-architecture.js`を実行する（[issue #904](https://github.com/bamiyanapp/karuta/issues/904)）。

関数からリソースへの依存関係は、関数コード内の`process.env.<変数名>`参照を静的に検出して導出している（AIによる意味解釈ではなく正規表現ベース）。エクスポートされた関数が直接、または1階層のヘルパー関数（`関数名(...)`という直接呼び出し構文）経由で参照している場合のみ検出でき、`array.map(helperFn)`のような関数の参照渡しは検出できない既知の制約がある。

```mermaid
graph LR
    Client[フロントエンド]
    APIGW[API Gateway<br/>HTTP API]
    WSGW[API Gateway<br/>WebSocket API]
    Polly[(AWS Polly)]
    getPhrase["getPhrase"]
    getCategories["getCategories"]
    getCongratulationAudio["getCongratulationAudio"]
    getPhrasesList["getPhrasesList"]
    postComment["postComment"]
    getComments["getComments"]
    recordTime["recordTime"]
    generateEfudaPdf["generateEfudaPdf"]
    renderEfudaPdfWorker["renderEfudaPdfWorker"]
    getEfudaPdfStatus["getEfudaPdfStatus"]
    createQuizRoom["createQuizRoom"]
    listQuizRooms["listQuizRooms"]
    checkQuizRoom["checkQuizRoom"]
    connectQuizRoom["connectQuizRoom"]
    disconnectQuizRoom["disconnectQuizRoom"]
    syncQuizRoom["syncQuizRoom"]
    updateQuizRoomState["updateQuizRoomState"]
    setQuizRoomName["setQuizRoomName"]
    buzzQuizRoom["buzzQuizRoom"]
    judgeQuizRoomBuzz["judgeQuizRoomBuzz"]
    resetQuizRoomPoints["resetQuizRoomPoints"]
    closeQuizRoom["closeQuizRoom"]
    table_karuta_phrases[(karuta-phrases<br/>(DynamoDB))]
    table_karuta_comments[(karuta-comments<br/>(DynamoDB))]
    table_karuta_polly_cache[(karuta-polly-cache<br/>(DynamoDB))]
    table_karuta_quiz_rooms[(karuta-quiz-rooms<br/>(DynamoDB))]
    table_karuta_quiz_room_connections[(karuta-quiz-room-connections<br/>(DynamoDB))]
    bucket_karuta_efuda_pdf___aws_accountId_[(karuta-efuda-pdf-${aws:accountId}<br/>(S3))]

    Client -->|HTTP| APIGW
    Client -->|WebSocket| WSGW
    APIGW --> getPhrase
    APIGW --> getCategories
    APIGW --> getCongratulationAudio
    APIGW --> getPhrasesList
    APIGW --> postComment
    APIGW --> getComments
    APIGW --> recordTime
    APIGW --> generateEfudaPdf
    APIGW --> getEfudaPdfStatus
    APIGW --> createQuizRoom
    APIGW --> listQuizRooms
    APIGW --> checkQuizRoom
    WSGW --> connectQuizRoom
    WSGW --> disconnectQuizRoom
    WSGW --> syncQuizRoom
    WSGW --> updateQuizRoomState
    WSGW --> setQuizRoomName
    WSGW --> buzzQuizRoom
    WSGW --> judgeQuizRoomBuzz
    WSGW --> resetQuizRoomPoints
    WSGW --> closeQuizRoom
    getPhrase --> table_karuta_polly_cache
    getPhrase --> table_karuta_phrases
    getCategories --> table_karuta_phrases
    getPhrasesList --> table_karuta_phrases
    postComment --> table_karuta_comments
    getComments --> table_karuta_comments
    recordTime --> table_karuta_phrases
    renderEfudaPdfWorker --> bucket_karuta_efuda_pdf___aws_accountId_
    getEfudaPdfStatus --> bucket_karuta_efuda_pdf___aws_accountId_
    createQuizRoom --> table_karuta_quiz_rooms
    listQuizRooms --> table_karuta_quiz_rooms
    checkQuizRoom --> table_karuta_quiz_rooms
    connectQuizRoom --> table_karuta_quiz_rooms
    connectQuizRoom --> table_karuta_quiz_room_connections
    disconnectQuizRoom --> table_karuta_quiz_room_connections
    disconnectQuizRoom --> table_karuta_quiz_rooms
    syncQuizRoom --> table_karuta_quiz_rooms
    updateQuizRoomState --> table_karuta_quiz_rooms
    setQuizRoomName --> table_karuta_quiz_rooms
    setQuizRoomName --> table_karuta_quiz_room_connections
    buzzQuizRoom --> table_karuta_quiz_rooms
    judgeQuizRoomBuzz --> table_karuta_quiz_rooms
    resetQuizRoomPoints --> table_karuta_quiz_rooms
    closeQuizRoom --> table_karuta_quiz_rooms
    getPhrase --> Polly
    getCongratulationAudio --> Polly
    generateEfudaPdf -->|非同期Invoke| renderEfudaPdfWorker
```
