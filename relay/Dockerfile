FROM dockurr/strfry:latest

# Install jq for the write policy script
RUN apt-get update && apt-get install -y jq && rm -rf /var/lib/apt/lists/*

# Copy config and write policy
COPY strfry.conf /etc/strfry.conf
COPY write-policy.sh /app/write-policy.sh
RUN chmod +x /app/write-policy.sh

# Create data directories
RUN mkdir -p /app/strfry-db /app/data

EXPOSE 7777

CMD ["strfry", "relay", "--config=/etc/strfry.conf"]
