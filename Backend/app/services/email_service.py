import boto3
from botocore.exceptions import ClientError
from flask import render_template
from app.config import Config

class EmailService:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(EmailService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    @classmethod
    def get_instance(cls):
        """Return the singleton EmailService instance."""
        return cls()

    def _initialize(self):
        # Initialize SES client
        # In a real environment, boto3 will pick up credentials from env automatically
        # if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set.
        # But we can pass them explicitly if they are set in Config.
        kwargs = {
            'region_name': Config.AWS_SES_REGION,
        }
        if Config.AWS_SES_ACCESS_KEY and Config.AWS_SES_SECRET_KEY:
            kwargs['aws_access_key_id'] = Config.AWS_SES_ACCESS_KEY
            kwargs['aws_secret_access_key'] = Config.AWS_SES_SECRET_KEY

        self.client = boto3.client('ses', **kwargs)
        self.sender = Config.MAIL_DEFAULT_SENDER

    def send_email(self, to_addresses, subject, html_body, text_body="Please view this email in an HTML-compatible client."):
        """
        Sends an email using AWS SES.
        to_addresses can be a list of strings or a single string.
        """
        if isinstance(to_addresses, str):
            to_addresses = [to_addresses]

        try:
            response = self.client.send_email(
                Destination={
                    'ToAddresses': to_addresses,
                },
                Message={
                    'Body': {
                        'Html': {
                            'Charset': "UTF-8",
                            'Data': html_body,
                        },
                        'Text': {
                            'Charset': "UTF-8",
                            'Data': text_body,
                        },
                    },
                    'Subject': {
                        'Charset': "UTF-8",
                        'Data': subject,
                    },
                },
                Source=self.sender,
            )
            return response['MessageId']
        except ClientError as e:
            print(f"[EmailService] Failed to send email to {to_addresses}: {e.response['Error']['Message']}")
            raise e

    def render_and_send(self, template_name, to_addresses, subject, **context):
        """
        Helper method to render a Jinja template and send it.
        Requires app context to render the template.
        """
        html_body = render_template(f"emails/{template_name}", **context)
        return self.send_email(to_addresses, subject, html_body)

def get_email_service():
    return EmailService()
