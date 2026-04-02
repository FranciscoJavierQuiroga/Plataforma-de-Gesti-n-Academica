#!/usr/bin/env python3
from keycloak import KeycloakOpenID
import json

# Configuración
keycloak_openid = KeycloakOpenID(
    server_url="http://localhost:8082",
    client_id="01",
    realm_name="plataformaInstitucional",
    client_secret_key="wP8EhQnsdaYcCSyFTnD2wu4n0dssApUz"
)

print("🔧 Probando conexión con Keycloak...\n")

# 1. Obtener clave pública
try:
    public_key = keycloak_openid.public_key()
    print("✅ Clave pública obtenida:")
    print(f"   {public_key[:50]}...\n")
except Exception as e:
    print(f"❌ Error obteniendo clave pública: {e}\n")

# 2. Obtener configuración del realm
try:
    well_known = keycloak_openid.well_known()
    print("✅ Configuración del realm:")
    print(f"   Issuer: {well_known.get('issuer')}")
    print(f"   Token endpoint: {well_known.get('token_endpoint')}")
    print(f"   Jwks URI: {well_known.get('jwks_uri')}\n")
except Exception as e:
    print(f"❌ Error obteniendo configuración: {e}\n")

# 3. Probar autenticación con un usuario
try:
    print("🔐 Probando autenticación...")
    token = keycloak_openid.token(
        username="estudiante1",  # Ajusta según tu usuario de Keycloak
        password="123456",       # Ajusta según la contraseña
        grant_type="password"
    )
    
    print("✅ Token obtenido:")
    print(f"   Access token: {token['access_token'][:50]}...")
    print(f"   Expires in: {token['expires_in']} segundos\n")
    
    # 4. Decodificar token
    access_token = token['access_token']
    public_key_pem = f"-----BEGIN PUBLIC KEY-----\n{public_key}\n-----END PUBLIC KEY-----"
    
    userinfo = keycloak_openid.decode_token(
        access_token,
        key=public_key_pem,
        options={
            "verify_signature": True,
            "verify_aud": False,
            "verify_exp": True
        }
    )
    
    print("✅ Token decodificado con verificación de firma:")
    print(f"   Usuario: {userinfo.get('preferred_username')}")
    print(f"   Email: {userinfo.get('email')}")
    print(f"   Realm roles: {userinfo.get('realm_access', {}).get('roles', [])}")
    print(f"   Resource access: {list(userinfo.get('resource_access', {}).keys())}")
    
    for client_id, data in userinfo.get('resource_access', {}).items():
        print(f"     - {client_id}: {data.get('roles', [])}")
    
except Exception as e:
    print(f"❌ Error en autenticación/decodificación: {e}")
    import traceback
    traceback.print_exc()