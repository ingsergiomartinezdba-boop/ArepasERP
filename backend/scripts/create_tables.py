import sys
import os

# Agrega el directorio padre al path para poder importar backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.database import engine, Base
from backend import sql_models # Importa los modelos para registrarlos en Base

if __name__ == "__main__":
    print("Creando tablas faltantes en la base de datos...")
    Base.metadata.create_all(bind=engine)
    print("Proceso finalizado. Las tablas que faltaban han sido creadas.")
