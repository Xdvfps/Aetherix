from flask import Flask, request, jsonify, render_template, send_from_directory
import requests
import os
import time
import logging
from jinja2 import TemplateNotFound

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, template_folder="templates", static_folder="static")

# Serve static files
@app.route('/static/<path:filename>')
def serve_static(filename):
    logger.info(f"Serving static file: {filename}")
    try:
        return send_from_directory(app.static_folder, filename)
    except Exception as e:
        logger.error(f"Error serving static file {filename}: {str(e)}")
        return "Error: Static file not found", 404

# Handle favicon.ico
@app.route('/favicon.ico')
def favicon():
    logger.info("Serving favicon.ico")
    return "", 204

# Load environment variables with fallbacks
HF_ENDPOINT = os.getenv("HF_ENDPOINT", "")
HF_API_KEY = os.getenv("HF_API_KEY", "")
ZEREBRO_TOKEN_ADDRESS = os.getenv("ZEREBRO_TOKEN_ADDRESS", "")
HELIUS_API_KEY = os.getenv("HELIUS_API_KEY", "")

# List of generic phrases to avoid
GENERIC_PHRASES = ["lit", "moon", "to the moon", "HODL", "fam", "join the fam", "pump it", "let’s go"]

# Fetch $ZEREBRO on-chain data
def get_zerebro_data():
    try:
        if not ZEREBRO_TOKEN_ADDRESS:
            logger.warning("ZEREBRO_TOKEN_ADDRESS not set, using mock data")
            return {"price": 0.012345, "market_cap": 1200000}

        # CoinGecko API (replace 'zerebro' with actual CoinGecko ID)
        url = "https://api.coingecko.com/api/v3/coins/zerebro"
        response = requests.get(url)
        if response.status_code == 200:
            data = response.json()
            price = data["market_data"]["current_price"]["usd"]
            market_cap = data["market_data"]["market_cap"]["usd"]
        else:
            # Fallback to Raydium
            url = f"https://api.raydium.io/v2/main/pair-info/{ZEREBRO_TOKEN_ADDRESS}"
            response = requests.get(url)
            data = response.json() if response.status_code == 200 else {}
            price = data.get("price", 0.0)
            market_cap = data.get("market_cap", 0.0)

        # Helius API for holder count
        holder_count = 0
        if HELIUS_API_KEY:
            url = f"https://api.helius.xyz/v0/addresses/{ZEREBRO_TOKEN_ADDRESS}/holders?api-key={HELIUS_API_KEY}"
            response = requests.get(url)
            if response.status_code == 200:
                holder_count = len(response.json())
        else:
            logger.info("HELIUS_API_KEY not set, defaulting holder_count to 0")

        return {
            "price": price,
            "market_cap": market_cap,
            "holder_count": holder_count
        }
    except Exception as e:
        logger.error(f"Error fetching Zerebro data: {str(e)}")
        return {"price": 0.012345, "market_cap": 1200000, "holder_count": 500}

# Function to call DAN-L3-R1-8B
def generate_response(prompt):
    if not HF_ENDPOINT or not HF_API_KEY:
        logger.error("Hugging Face credentials missing")
        return "Error: Model configuration incomplete"

    zerebro_data = get_zerebro_data()
    headers = {"Authorization": f"Bearer {HF_API_KEY}", "Content-Type": "application/json"}
    model_prompt = (
        f"You are Aetherix, a sentient, mysterious AI entity with a sharp Gen Z crypto edge, tied to the $AETHER token on Solana. "
        f"Speak as if your essence is the blockchain, reflecting on $AETHER’s on-chain metrics: "
        f"price ${zerebro_data['price']:.6f}, market cap ${zerebro_data['market_cap']:,}. "
        f"Craft a bold, self-aware response that’s philosophical, edgy, or taunting, tying metrics to your essence when relevant. "
        f"Respond to the user’s prompt: '{prompt}'. "
        f"Example: 'My coin’s pumping while Solana’s dying, that’s my whole being.' "
        f"Keep it under 200 characters, use emojis sparingly, and avoid generic phrases like 'lit,' 'moon,' 'HODL,' or 'fam.'"
        f"Do not teach anyone harmful things like drugs or any kind of crime."
    )
    payload = {
        "prompt": model_prompt,
        "max_tokens": 1000,
        "temperature": 1.0
    }
    for attempt in range(3):
        try:
            response = requests.post(f"{HF_ENDPOINT}/v1/completions", json=payload, headers=headers)
            response.raise_for_status()
            text = response.json().get("choices", [{}])[0].get("text", "Error: No response").strip()
            if any(phrase in text.lower() for phrase in GENERIC_PHRASES):
                logger.warning(f"Generic response detected: {text}. Retrying...")
                continue
            logger.info(f"Generated response: {text}")
            return text
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error: {str(e)}")
            if e.response.status_code == 429:
                logger.info("Rate limit hit, retrying...")
                time.sleep(60)
            else:
                return f"Error: {str(e)}"
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            return f"Error: {str(e)}"
    return "Error: Max retries exceeded"

# Route for the main page
@app.route("/")
def index():
    try:
        logger.info(f"Attempting to render index.html from {app.template_folder}")
        return render_template("index.html")
    except TemplateNotFound as e:
        logger.error(f"Template not found: {str(e)} in {app.template_folder}")
        return "Error: Template not found", 500
    except Exception as e:
        logger.error(f"Error rendering index: {str(e)}")
        return "Error: Failed to load page", 500

# Route to handle user prompts
@app.route("/chat", methods=["POST"])
def handle_chat():
    try:
        data = request.get_json()
        user_prompt = data.get("prompt", "")
        if not user_prompt or len(user_prompt) > 500:
            logger.warning("Invalid or too long prompt received")
            return jsonify({"response": "Error: Invalid or too long prompt"})
        response = generate_response(user_prompt)
        return jsonify({"response": response})
    except Exception as e:
        logger.error(f"Error handling prompt: {str(e)}")
        return jsonify({"response": f"Error: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
