from flask import Blueprint, jsonify, request, make_response
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    set_access_cookies,
    set_refresh_cookies,
    unset_jwt_cookies,
)
from app.models.user_model import UserModel

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    try:
        user = UserModel.create_user(email, password)
        return jsonify({"message": "Account created", "user": {"user_id": user["user_id"], "email": user["email"]}}), 201
    except ValueError as e:
        return jsonify({"error": str(e)}), 409


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = UserModel.get_user_by_email(email)
    if not user or not UserModel.verify_password(password, user["password_hash"]):
        return jsonify({"error": "Invalid credentials"}), 401

    UserModel.update_last_login(user["user_id"])
    access_token = create_access_token(identity=user["user_id"])
    refresh_token = create_refresh_token(identity=user["user_id"])

    response = make_response(jsonify({"user": {"user_id": user["user_id"], "email": user["email"]}}), 200)
    set_access_cookies(response, access_token)
    set_refresh_cookies(response, refresh_token)
    return response


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    response = make_response(jsonify({"message": "Logged out"}), 200)
    unset_jwt_cookies(response)
    return response


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_me():
    user_id = get_jwt_identity()
    user = UserModel.get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify({"user": user}), 200


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    access_token = create_access_token(identity=user_id)
    response = make_response(jsonify({"message": "Token refreshed"}), 200)
    set_access_cookies(response, access_token)
    return response
