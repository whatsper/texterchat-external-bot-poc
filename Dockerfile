FROM node:22.10-bookworm

ARG GIT_TAG=undefined
ARG GIT_COMMIT
ARG GIT_BRANCH=master
ARG GIT_DIRTY=undefined
ARG BUILD_CREATOR
ARG BUILD_NUMBER
ARG VERSION

LABEL tag=$GIT_TAG \
    branch=$GIT_BRANCH \
    commit=$GIT_COMMIT \
    dirty=$GIT_DIRTY \
    build-creator=$BUILD_CREATOR \
    build-number=$BUILD_NUMBER \
    version=$VERSION

COPY ./ /app-build/
COPY ./docker/entrypoint.sh /scripts/entrypoint.sh

RUN set -eux; \
    apt-get update; \
    chmod +x /scripts/*; \
    (cd /app-build && npm ci); \
    (cd /app-build && npm run build); \
    # Installing only production dependencies to reduce image size
    (rm -rf /app-build/node_modules && cd /app-build && npm ci --omit=dev); \
    # Copy builded app to working directory
    mkdir /app \
        && cp -r /app-build/build /app/build \
        && cp -r /app-build/node_modules /app/node_modules \
        && cp /app-build/package.json /app/ \
        && cp /app-build/package-lock.json /app/; \
    # Remove build artefacts
    rm -rf /app-build; \
    # Make node user owner of app files
    chown -R 1000:1000 /app; 

ENV NODE_ENV=production

USER 1000:1000

EXPOSE 4000

ENTRYPOINT [ "/scripts/entrypoint.sh" ]

CMD []
