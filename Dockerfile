FROM node:10
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install
COPY . .

RUN apt-get -qq update
RUN apt-get install -y build-essential 
RUN apt-get install -y libcairo2-dev 
RUN apt-get install -y libpango1.0-dev 
RUN apt-get install -y libjpeg-dev 
RUN apt-get install -y libgif-dev 
RUN apt-get install -y librsvg2-dev

EXPOSE 8080
CMD ["node", "server.js"]