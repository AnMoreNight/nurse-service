import requests
import os
from dotenv import load_dotenv

load_dotenv('.env')

url = "http://localhost:5000/bootstrap/create-admin"
headers = {"X-Bootstrap-Secret": os.getenv("BOOTSTRAP_SECRET")}
data = {
    "login_id": "admin@nurseservice.com",
    "password": "Admin@123",
    "name": "Super Admin"
}

response = requests.post(url, json=data, headers=headers)
print(response.status_code)
print(response.text)
