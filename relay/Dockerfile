FROM dockurr/strfry:latest

# Install jq for the write policy script
RUN apk add --no-cache jq

# Copy config and write policy
COPY strfry.conf /etc/strfry.conf
COPY write-policy.sh /app/write-policy.sh
RUN chmod +x /app/write-policy.sh

# Create data directories and non-root user
RUN mkdir -p /app/strfry-db /app/data && \
    addgroup -g 1001 relay && adduser -u 1001 -G relay -s /bin/sh -D relay && \
    chown -R relay:relay /app/strfry-db /app/data /app/write-policy.sh

USER relay

EXPOSE 7777

CMD ["/app/strfry", "relay", "--config=/etc/strfry.conf"]
