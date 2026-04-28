FROM node:22-bookworm

# Cài đặt bash và python
RUN apt-get update && apt-get install -y bash python3 make g++ 

# Cài đặt pnpm và công cụ hỗ trợ cho dev
RUN npm install -g pnpm dotenv-cli cross-env

WORKDIR /app
