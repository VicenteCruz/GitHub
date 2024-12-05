from flask import Flask, request, render_template, jsonify
import psycopg2
import os
import json

app = Flask(__name__)

# Database configuration (from Render environment variable)
DATABASE_URL = os.getenv("DATABASE_URL")

# Connect to PostgreSQL
conn = psycopg2.connect(DATABASE_URL)

# Create table if it doesn't exist
with conn.cursor() as cur:
    cur.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            data_compra DATE,
            supermercado VARCHAR(255),
            categoria VARCHAR(50),
            produto VARCHAR(255),
            preco NUMERIC(10, 2)
        )
    """)
    conn.commit()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    try:
        # Parse uploaded file
        file = request.files['file']
        json_data = json.load(file)

        # Insert data into database
        with conn.cursor() as cur:
            for item in json_data["produtos"]:
                cur.execute("""
                    INSERT INTO products (data_compra, supermercado, categoria, produto, preco)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    json_data["data_compra"],
                    json_data["supermercado"],
                    item["categoria"],
                    item["nome"],
                    item["preco"]
                ))
            conn.commit()

        return jsonify({"message": "Data saved to database!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/products', methods=['GET'])
def fetch_products():
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM products")
            rows = cur.fetchall()
            return jsonify(rows), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)
