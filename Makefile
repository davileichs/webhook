.PHONY: up down build rebuild logs ps

up:
	docker compose up -d --build

down:
	docker compose down

build:
	docker compose build

rebuild:
	docker compose build
	docker compose up -d --force-recreate

logs:
	docker compose logs -f --tail=200

ps:
	docker compose ps
