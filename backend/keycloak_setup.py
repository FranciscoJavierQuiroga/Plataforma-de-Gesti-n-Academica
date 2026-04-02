import requests
import json

KEYCLOAK_URL = "http://localhost:8082"
ADMIN_USER = "admin"
ADMIN_PASS = "admin"

REALM_NAME = "plataformaInstitucional"
CLIENT_ID = "01"
CLIENT_SECRET = "wP8EhQnsdaYcCSyFTnD2wu4n0dssApUz"

# ── 1. Get admin access token ────────────────────────────────────────────────
def get_admin_token():
    r = requests.post(
        f"{KEYCLOAK_URL}/realms/master/protocol/openid-connect/token",
        data={
            "client_id": "admin-cli",
            "username": ADMIN_USER,
            "password": ADMIN_PASS,
            "grant_type": "password",
        },
    )
    r.raise_for_status()
    return r.json()["access_token"]

# ── 2. Create realm ────────────────────────────────────────────────────────
def create_realm(token):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {
        "realm": REALM_NAME,
        "displayName": "Plataforma Institucional",
        "enabled": True,
        "registrationAllowed": False,
        "loginWithEmailAllowed": True,
        "duplicateEmailsAllowed": False,
        "resetPasswordAllowed": True,
        "editUsernameAllowed": False,
        "bruteForceProtected": True,
    }
    r = requests.post(f"{KEYCLOAK_URL}/admin/realms", headers=headers, json=payload)
    if r.status_code == 409:
        print("⚠  Realm already exists — skipping creation")
    else:
        r.raise_for_status()
        print(f"✔  Realm '{REALM_NAME}' created")

# ── 3. Create confidential client ─────────────────────────────────────────
def create_client(token):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {
        "clientId": CLIENT_ID,
        "name": "Plataforma Academica",
        "enabled": True,
        "clientAuthenticatorType": "client-secret",
        "secret": CLIENT_SECRET,
        "redirectUris": ["http://localhost:4200/*", "http://localhost:5000/*"],
        "webOrigins": ["http://localhost:4200"],
        "directAccessGrantsEnabled": True,   # needed for password grant login
        "serviceAccountsEnabled": True,
        "publicClient": False,
        "protocol": "openid-connect",
    }
    r = requests.post(
        f"{KEYCLOAK_URL}/admin/realms/{REALM_NAME}/clients",
        headers=headers,
        json=payload,
    )
    if r.status_code == 409:
        print("⚠  Client already exists — skipping creation")
    else:
        r.raise_for_status()
        print(f"✔  Client '{CLIENT_ID}' created")

# ── 4. Create realm roles ──────────────────────────────────────────────────
def create_roles(token):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    for role in ["administrador", "docente", "estudiante"]:
        r = requests.post(
            f"{KEYCLOAK_URL}/admin/realms/{REALM_NAME}/roles",
            headers=headers,
            json={"name": role},
        )
        if r.status_code == 409:
            print(f"⚠  Role '{role}' already exists")
        else:
            r.raise_for_status()
            print(f"✔  Role '{role}' created")

# ── 5. Get role ID by name ────────────────────────────────────────────────
def get_role_id(token, role_name):
    headers = {"Authorization": f"Bearer {token}"}
    r = requests.get(
        f"{KEYCLOAK_URL}/admin/realms/{REALM_NAME}/roles/{role_name}",
        headers=headers,
    )
    r.raise_for_status()
    return r.json()

# ── 6. Create a user and assign a role ────────────────────────────────────
def create_user(token, username, email, first_name, last_name, password, role_name):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = {
        "username": username,
        "email": email,
        "firstName": first_name,
        "lastName": last_name,
        "enabled": True,
        "emailVerified": True,
        "credentials": [{"type": "password", "value": password, "temporary": False}],
    }
    r = requests.post(
        f"{KEYCLOAK_URL}/admin/realms/{REALM_NAME}/users",
        headers=headers,
        json=payload,
    )
    if r.status_code == 409:
        print(f"⚠  User '{username}' already exists")
        # Fetch existing user ID
        r2 = requests.get(
            f"{KEYCLOAK_URL}/admin/realms/{REALM_NAME}/users?username={username}",
            headers=headers,
        )
        user_id = r2.json()[0]["id"]
    else:
        r.raise_for_status()
        user_id = r.headers["Location"].split("/")[-1]
        print(f"✔  User '{username}' created")

    # Assign realm role
    role = get_role_id(token, role_name)
    requests.post(
        f"{KEYCLOAK_URL}/admin/realms/{REALM_NAME}/users/{user_id}/role-mappings/realm",
        headers=headers,
        json=[role],
    ).raise_for_status()

# ── 7. Seed users (matching init_full2.js) ────────────────────────────────
USERS = [
    # (username, email, first, last, password, role)
    ("admin", "admin@colegio.edu.co", "Admin", "Sistema", "Admin123!", "administrador"),
    # Docentes
    ("juan.perez", "juan.perez@colegio.edu.co", "Juan Carlos", "Pérez Gómez", "Docente123!", "docente"),
    ("maria.lopez", "maria.lopez@colegio.edu.co", "María Fernanda", "López Martínez", "Docente123!", "docente"),
    ("carlos.garcia", "carlos.garcia@colegio.edu.co", "Carlos Alberto", "García Rodríguez", "Docente123!", "docente"),
    ("ana.martinez", "ana.martinez@colegio.edu.co", "Ana María", "Martínez Torres", "Docente123!", "docente"),
    ("luis.rodriguez", "luis.rodriguez@colegio.edu.co", "Luis Eduardo", "Rodríguez Castro", "Docente123!", "docente"),
    ("diana.torres", "diana.torres@colegio.edu.co", "Diana Patricia", "Torres Méndez", "Docente123!", "docente"),
    # Estudiantes
    ("carlos.ramirez", "carlos.ramirez@colegio.edu.co", "Carlos", "Ramirez López", "Estudiante123!", "estudiante"),
    ("ana.torres", "ana.torres@colegio.edu.co", "Ana", "Torres Gómez", "Estudiante123!", "estudiante"),
    ("sofia.mendez", "sofia.mendez@colegio.edu.co", "Sofía", "Méndez Castro", "Estudiante123!", "estudiante"),
    ("miguel.santos", "miguel.santos@colegio.edu.co", "Miguel", "Santos Díaz", "Estudiante123!", "estudiante"),
    ("laura.gonzalez", "laura.gonzalez@colegio.edu.co", "Laura", "González Ruiz", "Estudiante123!", "estudiante"),
    ("david.martinez", "david.martinez@colegio.edu.co", "David", "Martínez Vargas", "Estudiante123!", "estudiante"),
    ("valentina.lopez", "valentina.lopez@colegio.edu.co", "Valentina", "López Parra", "Estudiante123!", "estudiante"),
    ("santiago.herrera", "santiago.herrera@colegio.edu.co", "Santiago", "Herrera Ortiz", "Estudiante123!", "estudiante"),
    ("isabella.castro", "isabella.castro@colegio.edu.co", "Isabella", "Castro Rojas", "Estudiante123!", "estudiante"),
    ("andres.morales", "andres.morales@colegio.edu.co", "Andrés", "Morales Silva", "Estudiante123!", "estudiante"),
    ("camila.rivera", "camila.rivera@colegio.edu.co", "Camila", "Rivera Pérez", "Estudiante123!", "estudiante"),
    ("juan.diaz", "juan.diaz@colegio.edu.co", "Juan", "Díaz Ramírez", "Estudiante123!", "estudiante"),
]

if __name__ == "__main__":
    print("🔑 Getting admin token...")
    token = get_admin_token()
    
    print("\n📦 Creating realm...")
    create_realm(token)
    
    print("\n🔌 Creating client...")
    create_client(token)
    
    print("\n🎭 Creating roles...")
    create_roles(token)
    
    print("\n👤 Creating users...")
    for u in USERS:
        create_user(token, *u)
    
    print("\n✅ Keycloak setup complete!")
    print(f"   Admin console: {KEYCLOAK_URL}/admin")
    print(f"   Realm: {REALM_NAME}")
    print(f"   Login test: POST {KEYCLOAK_URL}/realms/{REALM_NAME}/protocol/openid-connect/token")