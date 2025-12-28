import requests
import os
from dotenv import load_dotenv

load_dotenv('.env')

url = "http://localhost:8000/bootstrap/create-admin"
headers = {"X-Bootstrap-Secret": os.getenv("BOOTSTRAP_SECRET")}
data = {
    "email": "admin@nurseservice.com",
    "password": "Admin@123",
    "name": "Super Admin",
    "company_name": "NurseService HQ"
}

response = requests.post(url, json=data, headers=headers)
print(response.status_code)
print(response.text)
