from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://jakdoo:jakdoo@localhost:5432/jakdoo"
    DB_HOST: str = ""
    DB_PORT: int = 5432
    DB_USER: str = ""
    DB_PASSWORD: str = ""
    DB_NAME: str = "postgres"

    @property
    def effective_database_url(self) -> str:
        if self.DB_HOST:
            from urllib.parse import quote_plus
            pw = quote_plus(self.DB_PASSWORD)
            return f"postgresql://{self.DB_USER}:{pw}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        return self.DATABASE_URL

    JWT_SECRET_KEY: str = "change-me-to-a-random-secret"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    KAKAO_CLIENT_ID: str = ""
    KAKAO_CLIENT_SECRET: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    S3_BUCKET: str = ""
    S3_REGION: str = "us-east-1"
    APP_ENV: str = "local"
    DEFAULT_LANGUAGE: str = "ko"
    ALLOW_DEV_LOGIN: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
