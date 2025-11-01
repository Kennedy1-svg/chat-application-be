# Start from the official Node image
FROM node:20

# Install qpdf
RUN apt-get update && apt-get install -y qpdf

# Create app directory
WORKDIR /usr/src/app

# Copy project files
COPY . .

# Install dependencies
RUN npm install

# Start your app 
CMD ["node", "app.js"]
