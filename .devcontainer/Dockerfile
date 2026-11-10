FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

WORKDIR /workspaces/unparse

COPY package*.json ./
RUN npm ci

USER node