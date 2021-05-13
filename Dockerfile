FROM node:8

WORKDIR /app
COPY . .
RUN npm install --production

EXPOSE 8080
ENTRYPOINT ["node", "app"]
