FROM node:14.17-alpine

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND yarn.lock are copied.
# Copying this separately prevents re-running npm install on every code change.
COPY .npmrc ./
COPY .yarnrc ./
COPY package.json ./
COPY yarn.lock ./
COPY prisma ./prisma

# Install production dependencies.
RUN yarn

# Copy local code to the container image.
COPY . ./

ENV NODE_ENV production
# Run the web service on container startup.
ENTRYPOINT [ "npm" ]
CMD [ "start" ]
