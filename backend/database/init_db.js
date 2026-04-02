// ==========================================
//   REINICIAR BASE DE DATOS
// ==========================================
use colegio;
db.dropDatabase();

print("✔ Base de datos 'colegio' eliminada");

use colegio;

// ==========================================
//   COLECCIÓN: USUARIOS
// ==========================================
// Busca la sección de usuarios (alrededor de línea 19) y actualiza:

db.createCollection("usuarios", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["correo", "rol"],
      properties: {
        correo: { bsonType: "string" },
        rol: {
          enum: ["estudiante", "docente", "administrador"],
          description: "Rol del usuario"
        },
        nombres: { bsonType: "string" },
        apellidos: { bsonType: "string" },
        documento: { bsonType: "string" },
        telefono: { bsonType: "string" },
        activo: { bsonType: "bool" },
        creado_en: { bsonType: "timestamp" },
        
        // ✅ CAMPOS ESPECÍFICOS DE ESTUDIANTE
        codigo_est: { bsonType: "string" },
        grupo: { 
          bsonType: "string",
          description: "Grupo del estudiante (ej: 10°A, 11°B)"
        },
        fecha_nacimiento: { bsonType: "date" },
        direccion: { bsonType: "string" },
        nombre_acudiente: { bsonType: "string" },
        telefono_acudiente: { bsonType: "string" },
        
        // ✅ CAMPOS ESPECÍFICOS DE DOCENTE
        especialidad: { bsonType: "string" },
        titulo: { bsonType: "string" }
      }
    }
  }
});

db.usuarios.createIndex({ correo: 1 }, { unique: true });
db.usuarios.createIndex({ rol: 1 });
db.usuarios.createIndex({ codigo_est: 1 }, { unique: true, sparse: true });
db.usuarios.createIndex({ grupo: 1 }); // ✅ NUEVO ÍNDICE

print("✔ Colección 'usuarios' creada con campo 'grupo'");

// ==========================================
//   COLECCIÓN: GRUPOS
// ==========================================
db.createCollection("grupos", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["nombre_grupo", "grado", "jornada"],
      properties: {
        nombre_grupo: { 
          bsonType: "string",
          description: "Nombre del grupo (ej: 10°A, 11°B)"
        },
        grado: { 
          bsonType: "string",
          description: "Grado (6, 7, 8, 9, 10, 11)"
        },
        jornada: {
          enum: ["mañana", "tarde"],
          description: "Jornada del grupo"
        },
        año_lectivo: { 
          bsonType: "string",
          description: "Año escolar (ej: 2025)"
        },
        director_grupo: { 
          bsonType: "objectId",
          description: "ID del docente director de grupo"
        },
        capacidad_max: { 
          bsonType: "int",
          description: "Capacidad máxima de estudiantes"
        },
        activo: { bsonType: "bool" },
        creado_en: { bsonType: "timestamp" }
      }
    }
  }
});

db.grupos.createIndex({ nombre_grupo: 1, año_lectivo: 1 }, { unique: true });
db.grupos.createIndex({ grado: 1 });

print("✔ Colección 'grupos' creada");
// ==========================================
//   COLECCIÓN: HORARIOS
// ==========================================
db.createCollection("horarios", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["grupo", "año_lectivo", "horario"],
      properties: {
        grupo: { 
          bsonType: "string",
          description: "Nombre del grupo (ej: 10°A)"
        },
        año_lectivo: { bsonType: "string" },
        horario: {
          bsonType: "array",
          description: "Bloques de horario",
          items: {
            bsonType: "object",
            required: ["hora_inicio", "hora_fin", "dia"],
            properties: {
              hora_inicio: { bsonType: "string" },
              hora_fin: { bsonType: "string" },
              dia: {
                enum: ["lunes", "martes", "miércoles", "jueves", "viernes"],
                description: "Día de la semana"
              },
              id_curso: { 
                bsonType: "objectId",
                description: "Curso que se dicta en este bloque"
              },
              curso_info: {
                bsonType: "object",
                properties: {
                  nombre_curso: { bsonType: "string" },
                  codigo_curso: { bsonType: "string" },
                  docente_nombres: { bsonType: "string" },
                  salon: { bsonType: "string" }
                }
              }
            }
          }
        },
        creado_en: { bsonType: "timestamp" },
        actualizado_en: { bsonType: "timestamp" }
      }
    }
  }
});

db.horarios.createIndex({ grupo: 1, año_lectivo: 1 }, { unique: true });

print("✔ Colección 'horarios' creada");
// ==========================================
//   COLECCIÓN: CURSOS
// ==========================================
db.createCollection("cursos", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["nombre_curso", "codigo_curso", "periodo"],
      properties: {
        nombre_curso: { bsonType: "string" },
        codigo_curso: { bsonType: "string" },
        id_docente: { bsonType: "objectId" },
        grado: { bsonType: "string" },
        periodo: {
          enum: ["1", "2", "3", "4"],
          description: "Periodo académico"
        },
        capacidad_max: { bsonType: "int" },
        activo: { bsonType: "bool" },
        docente_info: {
          bsonType: "object",
          properties: {
            nombres: { bsonType: "string" },
            apellidos: { bsonType: "string" },
            especialidad: { bsonType: "string" }
          }
        }
      }
    }
  }
});

db.cursos.createIndex({ codigo_curso: 1 }, { unique: true });
db.cursos.createIndex({ id_docente: 1 });
db.cursos.createIndex({ grado: 1, periodo: 1 });

print("✔ Colección 'cursos' creada con índices");

// ==========================================
//   COLECCIÓN: MATRICULAS
// ==========================================
db.createCollection("matriculas", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id_estudiante", "id_curso"],
      properties: {
        id_estudiante: { bsonType: "objectId" },
        id_curso: { bsonType: "objectId" },
        fecha_matricula: { bsonType: "timestamp" },
        estado: {
          enum: ["activo", "finalizado", "retirado", "pendiente"], // 🆕 Agregado "pendiente"
          description: "Estado de la matrícula"
        },
        // Busca la sección de calificaciones (alrededor de línea 111) y reemplaza con:

calificaciones: {
  bsonType: "array",
  items: {
    bsonType: "object",
    required: ["tipo", "nota", "peso", "fecha_eval", "periodo"], // ✅ AGREGAR periodo
    properties: {
      tipo: { bsonType: "string" },
      nota: { bsonType: ["double", "int"] },
      nota_maxima: { bsonType: ["double", "int"] },
      peso: { bsonType: ["double", "int"] },
      fecha_eval: { bsonType: "date" },
      periodo: { bsonType: "string", enum: ["1", "2", "3", "4"] }, // ✅ NUEVO CAMPO
      comentarios: { bsonType: "string" }
    }
  }
},
        estudiante_info: {
          bsonType: "object",
          properties: {
            nombres: { bsonType: "string" },
            apellidos: { bsonType: "string" },
            codigo_est: { bsonType: "string" }
          }
        },
        curso_info: {
          bsonType: "object",
          properties: {
            nombre_curso: { bsonType: "string" },
            codigo_curso: { bsonType: "string" },
            grado: { bsonType: "string" },
            periodo: { bsonType: "string" }
          }
        }
      }
    }
  }
});

db.matriculas.createIndex({ id_estudiante: 1, id_curso: 1 }, { unique: true });
db.matriculas.createIndex({ id_estudiante: 1 });
db.matriculas.createIndex({ id_curso: 1 });
db.matriculas.createIndex({ estado: 1 }); // 🆕 AGREGADO

print("✔ Colección 'matriculas' creada con índices");

// ==========================================
//   COLECCIÓN: REPORTES
// ==========================================
db.createCollection("reportes", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["tipo_reporte", "generado_por"],
      properties: {
        tipo_reporte: {
          enum: ["boletin", "resumen_curso", "rendimiento_docente", "certificado"]
        },
        generado_por: { bsonType: "objectId" },
        id_estudiante: { bsonType: "objectId" },
        id_curso: { bsonType: "objectId" },
        id_docente: { bsonType: "objectId" },
        fecha_generado: { bsonType: "timestamp" },
        datos_reporte: {
          bsonType: "object",
          description: "Datos específicos del reporte"
        }
      }
    }
  }
});

db.reportes.createIndex({ tipo_reporte: 1 });
db.reportes.createIndex({ fecha_generado: 1 });

print("✔ Colección 'reportes' creada con índices");

// ==========================================
//   COLECCIÓN: CERTIFICADOS
// ==========================================
db.createCollection("certificados", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id_estudiante", "tipo_certificado", "fecha_emision"], // 🔧 id_curso ya no es obligatorio
      properties: {
        id_estudiante: { bsonType: "objectId" },
        id_curso: { bsonType: "objectId" },
        tipo_certificado: { bsonType: "string" },
        fecha_emision: { bsonType: "date" },
        emitido_por: { bsonType: "objectId" },
        datos_certificado: {
          bsonType: "object"
        }
      }
    }
  }
});

db.certificados.createIndex({ id_estudiante: 1 });
db.certificados.createIndex({ fecha_emision: 1 });

print("✔ Colección 'certificados' creada con índices");

// ==========================================
//   COLECCIÓN: AUDITORÍA
// ==========================================
db.createCollection("auditoria", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["accion"],
      properties: {
        id_usuario: { bsonType: "objectId" },
        accion: { bsonType: "string" },
        id_entidad: { bsonType: "objectId" },
        detalles: { bsonType: ["string", "object"] }, // 🔧 Permitir objeto también
        fecha: { bsonType: "timestamp" },
        entidad_afectada: { bsonType: "string" },
        ip: { bsonType: "string" } // 🆕 AGREGADO
      }
    }
  }
});

db.auditoria.createIndex({ id_usuario: 1 });
db.auditoria.createIndex({ accion: 1 });
db.auditoria.createIndex({ fecha: 1 });

print("✔ Colección 'auditoria' creada con índices");
print("✅ Esquema de base de datos creado exitosamente");


// ==========================================
//   COLECCIÓN: ASISTENCIA
// ==========================================
db.createCollection("asistencia", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id_curso", "id_docente", "fecha", "registros"],
      properties: {
        id_curso: { bsonType: "objectId", description: "Referencia al curso" },
        id_docente: { bsonType: "objectId", description: "Referencia al docente que registra" },
        fecha: { bsonType: "date", description: "Fecha de la asistencia" },
        periodo: { bsonType: "string", description: "Periodo académico" },
        registros: {
          bsonType: "array",
          description: "Lista de asistencia de estudiantes",
          items: {
            bsonType: "object",
            required: ["id_estudiante", "estado"],
            properties: {
              id_estudiante: { bsonType: "objectId" },
              estudiante_info: {
                bsonType: "object",
                properties: {
                  nombres: { bsonType: "string" },
                  apellidos: { bsonType: "string" },
                  codigo_est: { bsonType: "string" }
                }
              },
              estado: {
                enum: ["presente", "ausente", "tarde", "excusa"],
                description: "Estado de asistencia"
              },
              observaciones: { bsonType: "string" }
            }
          }
        },
        curso_info: {
          bsonType: "object",
          properties: {
            nombre_curso: { bsonType: "string" },
            codigo_curso: { bsonType: "string" },
            grado: { bsonType: "string" }
          }
        },
        creado_en: { bsonType: "timestamp" },
        actualizado_en: { bsonType: "timestamp" }
      }
    }
  }
});
// Índices
db.asistencia.createIndex({ id_curso: 1, fecha: 1 });
db.asistencia.createIndex({ id_docente: 1 });
db.asistencia.createIndex({ fecha: -1 });

print("✔ Colección 'asistencia' creada con índices");

// ==========================================
//   COLECCIÓN: OBSERVACIONES
// ==========================================
db.createCollection("observaciones", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id_estudiante", "id_docente", "id_curso", "tipo", "descripcion", "fecha"],
      properties: {
        id_estudiante: { bsonType: "objectId", description: "Referencia al estudiante" },
        id_docente: { bsonType: "objectId", description: "Referencia al docente que registra" },
        id_curso: { bsonType: "objectId", description: "Referencia al curso" },
        tipo: {
          enum: ["positiva", "negativa", "neutral"],
          description: "Tipo de observación"
        },
        descripcion: { bsonType: "string", description: "Descripción de la observación" },
        fecha: { bsonType: "date", description: "Fecha de la observación" },
        seguimiento: { bsonType: "string", description: "Acciones de seguimiento tomadas" },
        categoria: { 
          enum: ["academica", "disciplinaria", "convivencia", "participacion", "otra"],
          description: "Categoría de la observación" 
        },
        gravedad: {
          enum: ["leve", "moderada", "grave"],
          description: "Nivel de gravedad (para observaciones negativas)"
        },
        notificado_acudiente: { bsonType: "bool", description: "Si se notificó al acudiente" },
        fecha_notificacion: { bsonType: "date", description: "Fecha en que se notificó" },
        estudiante_info: {
          bsonType: "object",
          properties: {
            nombres: { bsonType: "string" },
            apellidos: { bsonType: "string" },
            codigo_est: { bsonType: "string" }
          }
        },
        docente_info: {
          bsonType: "object",
          properties: {
            nombres: { bsonType: "string" },
            apellidos: { bsonType: "string" },
            especialidad: { bsonType: "string" }
          }
        },
        curso_info: {
          bsonType: "object",
          properties: {
            nombre_curso: { bsonType: "string" },
            codigo_curso: { bsonType: "string" },
            grado: { bsonType: "string" }
          }
        },
        archivos_adjuntos: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              nombre: { bsonType: "string" },
              url: { bsonType: "string" },
              tipo: { bsonType: "string" }
            }
          }
        },
        creado_en: { bsonType: "timestamp" },
        actualizado_en: { bsonType: "timestamp" }
      }
    }
  }
});

// Índices
db.observaciones.createIndex({ id_estudiante: 1 });
db.observaciones.createIndex({ id_docente: 1 });
db.observaciones.createIndex({ id_curso: 1 });
db.observaciones.createIndex({ tipo: 1 });
db.observaciones.createIndex({ fecha: -1 });
db.observaciones.createIndex({ categoria: 1 });

print("✔ Colección 'observaciones' creada con índices");

