# maintain similarity to CI by using common base image:
FROM ubuntu:20.04

RUN apt-get update && \
    apt-get --yes install \
        build-essential \
        curl \
        ruby-full \
        && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# TODO confirm ruby version is 2.7... if it matters
RUN gem install bundler -v 2.1.4

ENV NODE_VERSION=22.12.0
ENV NVM_DIR=/root/.nvm
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
RUN . "$NVM_DIR/nvm.sh" && nvm install 22
ENV PATH="$NVM_DIR/versions/node/v${NODE_VERSION}/bin/:${PATH}"

WORKDIR /pouchdb-docs

COPY package.json package-lock.json .
COPY ./bin/ ./bin/

COPY ./docs/Gemfile* ./docs/
RUN npm run install-jekyll
RUN rm -rf ./docs

RUN npm install --ci

CMD ["npm", "run", "build-site"]
