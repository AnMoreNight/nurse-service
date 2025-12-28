"""
Seed data script for NurseService
Run this after create_admin.py to populate the database with sample data
"""
import requests
import os
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

BASE_URL = "http://localhost:8000"

# First, login as admin to get token
login_data = {
    "email": "admin@nurseservice.com",
    "password": "Admin@123"
}

print("=== Logging in as admin ===")
login_response = requests.post(f"{BASE_URL}/auth/login", json=login_data)

if login_response.status_code != 200:
    print(f"✗ Login failed: {login_response.json()}")
    exit(1)

login_data_resp = login_response.json()
token = login_data_resp["access_token"]
company_id = login_data_resp["user"].get("company_id")

print(f"✓ Logged in successfully")
print(f"  Company ID: {company_id}")

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json"
}

# Create Staff Members
print("\n=== Creating Staff Members ===")
staff_members = [
    {"email": "tanaka@example.com", "password": "Pass123!", "name": "田中 花子", "profession": "看護師", "display_color": "blue", "role": "NormalUser"},
    {"email": "suzuki@example.com", "password": "Pass123!", "name": "鈴木 太郎", "profession": "看護師", "display_color": "green", "role": "NormalUser"},
    {"email": "sato@example.com", "password": "Pass123!", "name": "佐藤 美咲", "profession": "理学療法士", "display_color": "purple", "role": "NormalUser"},
    {"email": "yamamoto@example.com", "password": "Pass123!", "name": "山本 健一", "profession": "作業療法士", "display_color": "orange", "role": "NormalUser"},
    {"email": "watanabe@example.com", "password": "Pass123!", "name": "渡辺 さくら", "profession": "看護師", "display_color": "pink", "role": "CompanyAdmin"},
]

created_staff_ids = []
for staff in staff_members:
    response = requests.post(f"{BASE_URL}/users", json=staff, headers=headers)
    if response.status_code == 200:
        user_id = response.json().get("user_id")
        created_staff_ids.append(user_id)
        print(f"  ✓ Created: {staff['name']} ({staff['profession']}) - ID: {user_id}")
    else:
        print(f"  ✗ Failed to create {staff['name']}: {response.json()}")

# Get default statuses (or create them)
print("\n=== Getting/Creating Statuses ===")
status_response = requests.get(f"{BASE_URL}/statuses", headers=headers)
statuses = []
if status_response.status_code == 200:
    statuses = status_response.json()
    if len(statuses) > 0:
        print(f"  ✓ Found {len(statuses)} existing statuses")
    else:
        # Create default statuses
        default_statuses = [
            {"name": "定期訪問(看護)", "color": "blue"},
            {"name": "定期訪問(リハビリ)", "color": "green"},
            {"name": "緊急訪問", "color": "red"},
            {"name": "その他", "color": "gray"},
            {"name": "キャンセル", "color": "yellow"},
        ]
        for status in default_statuses:
            res = requests.post(f"{BASE_URL}/statuses", json=status, headers=headers)
            if res.status_code == 200:
                statuses.append(res.json())
                print(f"  ✓ Created status: {status['name']}")

# Create sample visits/schedules
print("\n=== Creating Sample Schedules ===")
if len(created_staff_ids) > 0 and len(statuses) > 0:
    today = datetime.now()
    
    sample_visits = [
        {
            "patient_name": "山田 一郎",
            "visit_address": "東京都渋谷区恵比寿1-2-3",
            "start_time": (today.replace(hour=9, minute=0, second=0)).isoformat(),
            "end_time": (today.replace(hour=10, minute=0, second=0)).isoformat(),
            "status_id": statuses[0]["status_id"] if statuses else None,
            "memo": "血圧測定、服薬確認",
            "assigned_user_ids": [created_staff_ids[0]] if created_staff_ids else [],
        },
        {
            "patient_name": "佐々木 花子",
            "visit_address": "東京都目黒区中目黒2-3-4",
            "start_time": (today.replace(hour=10, minute=30, second=0)).isoformat(),
            "end_time": (today.replace(hour=11, minute=30, second=0)).isoformat(),
            "status_id": statuses[1]["status_id"] if len(statuses) > 1 else statuses[0]["status_id"],
            "memo": "リハビリ訓練",
            "assigned_user_ids": [created_staff_ids[2]] if len(created_staff_ids) > 2 else [],
        },
        {
            "patient_name": "高橋 次郎",
            "visit_address": "東京都港区六本木3-4-5",
            "start_time": (today.replace(hour=14, minute=0, second=0)).isoformat(),
            "end_time": (today.replace(hour=15, minute=0, second=0)).isoformat(),
            "status_id": statuses[0]["status_id"] if statuses else None,
            "memo": "定期健康チェック",
            "assigned_user_ids": [created_staff_ids[1]] if len(created_staff_ids) > 1 else [],
        },
    ]
    
    for visit in sample_visits:
        if visit["status_id"] and visit["assigned_user_ids"]:
            response = requests.post(f"{BASE_URL}/schedules", json=visit, headers=headers)
            if response.status_code == 200:
                print(f"  ✓ Created visit for: {visit['patient_name']}")
            else:
                print(f"  ✗ Failed to create visit for {visit['patient_name']}: {response.json()}")

print("\n=== Seed Data Complete ===")
print(f"Created {len(created_staff_ids)} staff members")
print("You can now login to the frontend and see the data!")
print("\nLogin credentials for testing:")
print("  Admin: admin@nurseservice.com / Admin@123")
print("  Staff: tanaka@example.com / Pass123!")
