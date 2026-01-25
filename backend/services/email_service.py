"""
Email service for sending password reset and invitation emails using SMTP.
"""
import os
import logging
from typing import Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import aiosmtplib

logger = logging.getLogger(__name__)

class EmailService:
    """Production-ready email service using SMTP"""
    
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER", "")
        self.smtp_password = os.getenv("SMTP_PASSWORD", "")
        self.from_email = os.getenv("FROM_EMAIL", self.smtp_user)
        self.from_name = os.getenv("FROM_NAME", "NurseService")
        self.frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        
        if not self.smtp_user or not self.smtp_password:
            logger.warning("SMTP credentials not configured. Emails will be logged only.")
    
    async def _send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """Send email via SMTP"""
        try:
            # If SMTP not configured, just log
            if not self.smtp_user or not self.smtp_password:
                logger.info(f"Email to {to_email}: {subject}")
                logger.info(f"Content: {html_content}")
                return True
            
            message = MIMEMultipart("alternative")
            message["Subject"] = subject
            message["From"] = f"{self.from_name} <{self.from_email}>"
            message["To"] = to_email
            
            html_part = MIMEText(html_content, "html", "utf-8")
            message.attach(html_part)
            
            await aiosmtplib.send(
                message,
                hostname=self.smtp_host,
                port=self.smtp_port,
                username=self.smtp_user,
                password=self.smtp_password,
                start_tls=True,
            )
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False
    
    async def send_password_reset_email(self, email: str, reset_token: str, user_name: Optional[str] = None) -> bool:
        """Send password reset email to user"""
        reset_link = f"{self.frontend_url}/reset-password?token={reset_token}"
        
        display_name = user_name or "ユーザー"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }}
                .button {{ display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>パスワードリセット</h1>
                </div>
                <div class="content">
                    <p>こんにちは {display_name} 様、</p>
                    <p>パスワードリセットのリクエストを受け付けました。</p>
                    <p>以下のボタンをクリックして、新しいパスワードを設定してください：</p>
                    <div style="text-align: center;">
                        <a href="{reset_link}" class="button">パスワードをリセット</a>
                    </div>
                    <p style="color: #666; font-size: 14px;">
                        または、以下のリンクをコピーしてブラウザに貼り付けてください：<br>
                        <code style="background: #f5f5f5; padding: 10px; display: block; margin-top: 10px; word-break: break-all;">{reset_link}</code>
                    </p>
                    <p style="color: #e74c3c; margin-top: 20px;">
                        <strong>重要：</strong> このリンクは1時間有効です。
                    </p>
                    <p>もしこのリクエストに心当たりがない場合は、このメールを無視してください。</p>
                </div>
                <div class="footer">
                    <p>© 2026 NurseService. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await self._send_email(
            to_email=email,
            subject="パスワードリセットのリクエスト - NurseService",
            html_content=html_content
        )
    
    async def send_invitation_email(self, email: str, invitation_token: str, company_name: str) -> bool:
        """Send invitation email to new user"""
        invitation_link = f"{self.frontend_url}/accept-invitation?token={invitation_token}"
        
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }}
                .button {{ display: inline-block; padding: 15px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
                .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>{company_name}への招待</h1>
                </div>
                <div class="content">
                    <p>こんにちは、</p>
                    <p><strong>{company_name}</strong>からNurseServiceへの招待を受け取りました。</p>
                    <p>以下のボタンをクリックしてアカウントを作成してください：</p>
                    <div style="text-align: center;">
                        <a href="{invitation_link}" class="button">アカウントを作成</a>
                    </div>
                    <p style="color: #666; font-size: 14px;">
                        または、以下のリンクをコピーしてブラウザに貼り付けてください：<br>
                        <code style="background: #f5f5f5; padding: 10px; display: block; margin-top: 10px; word-break: break-all;">{invitation_link}</code>
                    </p>
                    <p style="color: #e74c3c; margin-top: 20px;">
                        <strong>重要：</strong> このリンクは7日間有効です。
                    </p>
                </div>
                <div class="footer">
                    <p>© 2026 NurseService. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return await self._send_email(
            to_email=email,
            subject=f"{company_name}への招待 - NurseService",
            html_content=html_content
        )

# Global email service instance
email_service = EmailService()

