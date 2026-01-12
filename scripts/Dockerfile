FROM node:20

WORKDIR /app

COPY package.json package-lock.json .releaserc.cjs ./ 
COPY scripts/ scripts/

RUN npm install

COPY .github/workflows/cd.yml .github/workflows/cd.yml
COPY .git/ .git/

# semantic-release が必要とする認証情報を環境変数として設定
ENV GITHUB_TOKEN="your_github_token_here"

CMD ["/bin/bash"]
