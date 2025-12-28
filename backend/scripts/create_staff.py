import requests
import os
from dotenv import load_dotenv

load_dotenv('.env')

# First, login as admin to get token
login_url = "http://localhost:8000/auth/login"
login_data = {
    "email": "admin@nurseservice.com",
    "password": "Admin@123"
}

print("Logging in as admin...")
login_response = requests.post(login_url, json=login_data)
if login_response.status_code != 200:
    print(f"Login failed: {login_response.status_code}")
    print(login_response.text)
    exit(1)

response_data = login_response.json()
token = response_data["access_token"]
company_id = response_data["user"]["company_id"]
print(f"Login successful! Company ID: {company_id}")

# Create staff user
create_user_url = "http://localhost:8000/users"
headers = {"Authorization": f"Bearer {token}"}
staff_data = {
    "email": "staff@nurseservice.com",
    "password": "Staff@123",
    "name": "Staff User",
    "role": "NORMAL_USER",
    "jobTitle": "Nurse",
    "profession": "Registered Nurse",
    "joinDate": "2025-01-01"
}

print("\nCreating staff user...")
response = requests.post(create_user_url, json=staff_data, headers=headers)
print(f"Status: {response.status_code}")
print(response.text)

if response.status_code == 200:
    print("\n✓ Staff user created successfully!")
    print("  Email: staff@nurseservice.com")
    print("  Password: Staff@123")
