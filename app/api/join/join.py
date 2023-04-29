# pip3 install requests
import requests
import json

API_KEY = "featlytalksfu_default_secret"
FEATLYTALK_URL = "https://talk.featly.io/api/v1/join"
# FEATLYTALK_URL = "http://localhost:3010/api/v1/join"

headers = {
    "authorization": API_KEY,
    "Content-Type": "application/json",
}

data = {
    "room": "test",
    "password": "false",
    "name": "featlytalksfu",
    "audio": "true",
    "video": "true",
    "screen": "true",
    "notify": "true",
}

response = requests.post(
    FEATLYTALK_URL,
    headers=headers,
    json=data,
)

print("Status code:", response.status_code)
data = json.loads(response.text)
print("join:", data["join"])
