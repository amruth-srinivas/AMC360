import psycopg


TARGET_DB = "amc_management"
ADMIN_DSN = "postgresql://postgres:postgres@localhost:5432/postgres"


def main() -> None:
    with psycopg.connect(ADMIN_DSN, autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT 1 FROM pg_database WHERE datname = %s",
                (TARGET_DB,),
            )
            exists = cur.fetchone() is not None
            if not exists:
                cur.execute(f'CREATE DATABASE "{TARGET_DB}"')
                print("created")
            else:
                print("already exists")


if __name__ == "__main__":
    main()
