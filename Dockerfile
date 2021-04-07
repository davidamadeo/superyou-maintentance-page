FROM node:12-alpine

COPY package*.json ./
RUN npm install
COPY . .

CMD ["npm", "run", "build"]
CMD ["npm", "run", "start"]