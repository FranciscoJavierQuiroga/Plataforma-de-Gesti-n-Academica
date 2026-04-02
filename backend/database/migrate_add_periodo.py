"""
Script para agregar campo 'periodo' a calificaciones existentes en MongoDB
"""

import sys
import os

# Agregar el path del backend para importar db_config
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.db_config import get_matriculas_collection
from pymongo import UpdateOne

def migrar_calificaciones():
    """Agregar campo 'periodo' a todas las calificaciones sin este campo"""
    try:
        print("🔄 Iniciando migración de calificaciones...")
        
        matriculas_collection = get_matriculas_collection()
        
        # Obtener todas las matrículas
        matriculas = list(matriculas_collection.find({}))
        
        print(f"📊 Total de matrículas encontradas: {len(matriculas)}")
        
        bulk_operations = []
        total_calificaciones_actualizadas = 0
        
        for matricula in matriculas:
            calificaciones = matricula.get('calificaciones', [])
            
            if not calificaciones:
                continue
            
            # Verificar si alguna calificación no tiene periodo
            calificaciones_actualizadas = []
            hay_cambios = False
            
            for i, calificacion in enumerate(calificaciones):
                if 'periodo' not in calificacion:
                    # Asignar periodo '1' por defecto
                    calificacion['periodo'] = '1'
                    hay_cambios = True
                    total_calificaciones_actualizadas += 1
                
                calificaciones_actualizadas.append(calificacion)
            
            # Si hubo cambios, agregar operación de actualización
            if hay_cambios:
                bulk_operations.append(
                    UpdateOne(
                        {'_id': matricula['_id']},
                        {'$set': {'calificaciones': calificaciones_actualizadas}}
                    )
                )
        
        # Ejecutar actualizaciones en lote
        if bulk_operations:
            result = matriculas_collection.bulk_write(bulk_operations)
            print(f"✅ Actualizado {result.modified_count} documentos")
            print(f"✅ Total de calificaciones actualizadas: {total_calificaciones_actualizadas}")
        else:
            print("ℹ️  No se encontraron calificaciones sin el campo 'periodo'")
        
        print("✅ Migración completada exitosamente")
        
        # Verificar resultado
        print("\n🔍 Verificando migración...")
        sample = matriculas_collection.find_one({'calificaciones': {'$exists': True, '$ne': []}})
        
        if sample and 'calificaciones' in sample:
            print(f"📋 Ejemplo de calificación migrada:")
            print(f"   Tipo: {sample['calificaciones'][0].get('tipo')}")
            print(f"   Nota: {sample['calificaciones'][0].get('nota')}")
            print(f"   Periodo: {sample['calificaciones'][0].get('periodo')} ✅")
        
    except Exception as e:
        print(f"❌ Error durante la migración: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    migrar_calificaciones()