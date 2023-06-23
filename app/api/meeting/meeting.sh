#!/bin/bash

API_KEY="featlytalksfu_default_secret"
# FEATLYTALK_URL="https://featly.io/api/v1/meeting"
FEATLYTALK_URL="https://localhost:3010/api/v1/join"

curl $FEATLYTALK_URL \
    --header "authorization: $API_KEY" \
    --header "Content-Type: application/json" \
    --request POST
