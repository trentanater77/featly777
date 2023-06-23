# pip3 install requests
# pip3 install requests
import requests
import json

API_KEY = "featlytalksfu_default_secret"
# FEATLYTALK_URL = "https://featly.io/api/v1/meeting"
FEATLYTALK_URL = "https://localhost:3010/api/v1/join"

headers = {
    "authorization": API_KEY,
    "Content-Type": "application/json",
}

response = requests.post(
    FEATLYTALK_URL,
    headers=headers
)

print("Status code:", response.status_code)
data = json.loads(response.text)
print("meeting:", data["meeting"])
