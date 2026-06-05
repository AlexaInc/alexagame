FROM node:18-slim

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production

COPY . .

ARG GIPHY_API_KEY=Ei3iNGXxdCwjwyxwvSaLq7BgNaOLPFEh
ENV GIPHY_API_KEY=${GIPHY_API_KEY}
RUN node scripts/downloadGifs.js

EXPOSE 7860

ENV PORT=7860
ENV NODE_ENV=production

CMD [ "npm", "start" ]
