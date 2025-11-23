// ==========================================
//   SCRIPT DE INICIALIZACIÓN COMPLETO
//   Base de datos optimizada para el sistema
// ==========================================

use colegio;

print("🗑️  Eliminando base de datos anterior...");
db.dropDatabase();
print("✔ Base de datos 'colegio' eliminada\n");

use colegio;

// ==========================================
//   COLECCIÓN: USUARIOS
// ==========================================
db.createCollection("usuarios", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["correo", "rol", "activo"],
      properties: {
        correo: { bsonType: "string" },
        rol: { enum: ["estudiante", "docente", "administrador"] },
        nombres: { bsonType: "string" },
        apellidos: { bsonType: "string" },
        documento: { bsonType: "string" },
        telefono: { bsonType: "string" },
        activo: { bsonType: "bool" },
        creado_en: { bsonType: "timestamp" },
        keycloak_id: { bsonType: "string" },
        
        // Estudiante
        codigo_est: { bsonType: "string" },
        id_grupo: { bsonType: "objectId" },
        fecha_nacimiento: { bsonType: "date" },
        direccion: { bsonType: "string" },
        nombre_acudiente: { bsonType: "string" },
        telefono_acudiente: { bsonType: "string" },
        
        // Docente
        codigo_docente: { bsonType: "string" },
        especialidad: { bsonType: "string" },
        titulo: { bsonType: "string" },
        fecha_ingreso: { bsonType: "date" }
      }
    }
  }
});

db.usuarios.createIndex({ correo: 1 }, { unique: true });
db.usuarios.createIndex({ rol: 1 });
db.usuarios.createIndex({ codigo_est: 1 }, { unique: true, sparse: true });
db.usuarios.createIndex({ codigo_docente: 1 }, { unique: true, sparse: true });
db.usuarios.createIndex({ id_grupo: 1 });
db.usuarios.createIndex({ keycloak_id: 1 });

print("✔ Colección 'usuarios' creada");

// ==========================================
//   COLECCIÓN: GRUPOS
// ==========================================
db.createCollection("grupos", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["nombre_grupo", "grado", "jornada", "anio_lectivo"],
      properties: {
        nombre_grupo: { bsonType: "string" },
        grado: { bsonType: "string" },
        jornada: { enum: ["mañana", "tarde"] },
        anio_lectivo: { bsonType: "string" },
        id_director_grupo: { bsonType: "objectId" },
        director_info: {
          bsonType: "object",
          properties: {
            nombres: { bsonType: "string" },
            apellidos: { bsonType: "string" },
            codigo_docente: { bsonType: "string" }
          }
        },
        capacidad_max: { bsonType: "int" },
        estudiantes_actuales: { bsonType: "int" },
        salon_principal: { bsonType: "string" },
        activo: { bsonType: "bool" },
        creado_en: { bsonType: "timestamp" }
      }
    }
  }
});

db.grupos.createIndex({ nombre_grupo: 1, anio_lectivo: 1 }, { unique: true });
db.grupos.createIndex({ grado: 1, jornada: 1 });
db.grupos.createIndex({ activo: 1 });

print("✔ Colección 'grupos' creada");

// ==========================================
//   COLECCIÓN: CURSOS
// ==========================================
db.createCollection("cursos", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["nombre_curso", "codigo_curso", "grado", "area"],
      properties: {
        nombre_curso: { bsonType: "string" },
        codigo_curso: { bsonType: "string" },
        grado: { bsonType: "string" },
        area: { bsonType: "string" },
        descripcion: { bsonType: "string" },
        creditos: { bsonType: "int" },
        intensidad_horaria_semanal: { bsonType: "int" },
        activo: { bsonType: "bool" },
        creado_en: { bsonType: "timestamp" }
      }
    }
  }
});

db.cursos.createIndex({ codigo_curso: 1 }, { unique: true });
db.cursos.createIndex({ grado: 1, area: 1 });
db.cursos.createIndex({ activo: 1 });

print("✔ Colección 'cursos' creada");

// ==========================================
//   COLECCIÓN: ASIGNACIONES_DOCENTES
// ==========================================
db.createCollection("asignaciones_docentes", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id_grupo", "id_curso", "id_docente", "periodo", "anio_lectivo"],
      properties: {
        id_grupo: { bsonType: "objectId" },
        id_curso: { bsonType: "objectId" },
        id_docente: { bsonType: "objectId" },
        periodo: { enum: ["1", "2", "3", "4"] },
        anio_lectivo: { bsonType: "string" },
        grupo_info: { bsonType: "object" },
        curso_info: { bsonType: "object" },
        docente_info: { bsonType: "object" },
        salon_asignado: { bsonType: "string" },
        activo: { bsonType: "bool" },
        creado_en: { bsonType: "timestamp" }
      }
    }
  }
});

db.asignaciones_docentes.createIndex({ id_grupo: 1, id_curso: 1, periodo: 1 }, { unique: true });
db.asignaciones_docentes.createIndex({ id_docente: 1, periodo: 1 });
db.asignaciones_docentes.createIndex({ activo: 1 });

print("✔ Colección 'asignaciones_docentes' creada");

// ==========================================
//   COLECCIÓN: HORARIOS
// ==========================================
db.createCollection("horarios", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["grupo", "año_lectivo", "horario"],
      properties: {
        grupo: { bsonType: "string" },
        año_lectivo: { bsonType: "string" },
        horario: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["hora_inicio", "hora_fin", "dia"],
            properties: {
              hora_inicio: { bsonType: "string" },
              hora_fin: { bsonType: "string" },
              dia: { enum: ["lunes", "martes", "miércoles", "jueves", "viernes"] },
              id_curso: { bsonType: "objectId" },
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
        creado_en: { bsonType: "timestamp" }
      }
    }
  }
});

db.horarios.createIndex({ grupo: 1, año_lectivo: 1 }, { unique: true });

print("✔ Colección 'horarios' creada");

// ==========================================
//   COLECCIÓN: MATRICULAS
// ==========================================
db.createCollection("matriculas", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id_estudiante", "id_grupo", "anio_lectivo", "estado"],
      properties: {
        id_estudiante: { bsonType: "objectId" },
        id_grupo: { bsonType: "objectId" },
        anio_lectivo: { bsonType: "string" },
        fecha_matricula: { bsonType: "timestamp" },
        estado: { enum: ["activa", "inactiva", "retirada"] },
        estudiante_info: {
          bsonType: "object",
          properties: {
            nombres: { bsonType: "string" },
            apellidos: { bsonType: "string" },
            codigo_est: { bsonType: "string" },
            documento: { bsonType: "string" }
          }
        },
        grupo_info: {
          bsonType: "object",
          properties: {
            nombre_grupo: { bsonType: "string" },
            grado: { bsonType: "string" },
            jornada: { bsonType: "string" }
          }
        },
        calificaciones: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["id_asignacion", "periodo", "notas"],
            properties: {
              id_asignacion: { bsonType: "objectId" },
              periodo: { enum: ["1", "2", "3", "4"] },
              notas: {
                bsonType: "array",
                items: {
                  bsonType: "object",
                  required: ["tipo", "nota", "nota_maxima", "peso", "fecha_eval"],
                  properties: {
                    tipo: { bsonType: "string" },
                    nota: { bsonType: ["double", "int"] },
                    nota_maxima: { bsonType: ["double", "int"] },
                    peso: { bsonType: ["double", "int"] },
                    fecha_eval: { bsonType: "date" },
                    comentarios: { bsonType: "string" }
                  }
                }
              }
            }
          }
        },
        observaciones: { bsonType: "string" },
        creado_en: { bsonType: "timestamp" }
      }
    }
  }
});

db.matriculas.createIndex({ id_estudiante: 1, anio_lectivo: 1 }, { unique: true });
db.matriculas.createIndex({ id_estudiante: 1, id_grupo: 1 });
db.matriculas.createIndex({ estado: 1 });

print("✔ Colección 'matriculas' creada");

// ==========================================
//   COLECCIÓN: OBSERVACIONES
// ==========================================
db.createCollection("observaciones", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id_estudiante", "id_docente", "tipo", "descripcion", "fecha"],
      properties: {
        id_estudiante: { bsonType: "objectId" },
        id_docente: { bsonType: "objectId" },
        id_curso: { bsonType: "objectId" },
        tipo: { enum: ["positiva", "negativa", "neutral"] },
        categoria: { enum: ["academica", "disciplinaria", "convivencia", "participacion", "otra"] },
        descripcion: { bsonType: "string" },
        fecha: { bsonType: "date" },
        seguimiento: { bsonType: "string" },
        gravedad: { enum: ["leve", "moderada", "grave"] },
        notificado_acudiente: { bsonType: "bool" },
        fecha_notificacion: { bsonType: "date" },
        estudiante_info: { bsonType: "object" },
        docente_info: { bsonType: "object" },
        curso_info: { bsonType: "object" },
        creado_en: { bsonType: "timestamp" }
      }
    }
  }
});

db.observaciones.createIndex({ id_estudiante: 1, fecha: -1 });
db.observaciones.createIndex({ id_docente: 1, fecha: -1 });
db.observaciones.createIndex({ tipo: 1, categoria: 1 });

print("✔ Colección 'observaciones' creada");

// ==========================================
//   COLECCIÓN: ASISTENCIA
// ==========================================
db.createCollection("asistencia", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["id_asignacion", "id_docente", "fecha", "registros"],
      properties: {
        id_asignacion: { bsonType: "objectId" },
        id_docente: { bsonType: "objectId" },
        fecha: { bsonType: "date" },
        periodo: { enum: ["1", "2", "3", "4"] },
        registros: {
          bsonType: "array",
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
              estado: { enum: ["presente", "ausente", "tarde", "excusa"] },
              observaciones: { bsonType: "string" }
            }
          }
        },
        grupo_info: { bsonType: "object" },
        curso_info: { bsonType: "object" },
        creado_en: { bsonType: "timestamp" }
      }
    }
  }
});

db.asistencia.createIndex({ id_asignacion: 1, fecha: 1 });
db.asistencia.createIndex({ id_docente: 1, fecha: -1 });

print("✔ Colección 'asistencia' creada");

// ==========================================
//   COLECCIÓN: REPORTES
// ==========================================
db.createCollection("reportes");
print("✔ Colección 'reportes' creada");

// ==========================================
//   COLECCIÓN: CERTIFICADOS
// ==========================================
db.createCollection("certificados");
print("✔ Colección 'certificados' creada");

// ==========================================
//   COLECCIÓN: AUDITORÍA
// ==========================================
db.createCollection("auditoria", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      properties: {
        id_usuario: { bsonType: "objectId" },
        accion: { bsonType: "string" },
        entidad_afectada: { bsonType: "string" },
        detalles: { bsonType: "object" },
        fecha: { bsonType: "timestamp" },
        ip: { bsonType: "string" }
      }
    }
  }
});

db.auditoria.createIndex({ id_usuario: 1, fecha: -1 });
db.auditoria.createIndex({ accion: 1 });

print("✔ Colección 'auditoria' creada");

print("\n✅ Esquema de base de datos creado\n");

// ==========================================
//   DATOS DE PRUEBA
// ==========================================

print("🌱 Insertando datos de prueba...\n");

// ADMINISTRADOR
const admin = db.usuarios.insertOne({
  correo: "admin@colegio.edu.co",
  rol: "administrador",
  nombres: "Admin",
  apellidos: "Sistema",
  telefono: "3001234567",
  documento: "1234567890",
  activo: true,
  creado_en: Timestamp()
}).insertedId;

print("✔ Administrador creado");

// DOCENTES
const docentes = [
  { correo: "juan.perez@colegio.edu.co", nombres: "Juan Carlos", apellidos: "Pérez Gómez", codigo: "DOC001", esp: "Matemáticas" },
  { correo: "maria.lopez@colegio.edu.co", nombres: "María Fernanda", apellidos: "López Martínez", codigo: "DOC002", esp: "Lengua Castellana" },
  { correo: "carlos.garcia@colegio.edu.co", nombres: "Carlos Alberto", apellidos: "García Rodríguez", codigo: "DOC003", esp: "Ciencias Naturales" },
  { correo: "ana.martinez@colegio.edu.co", nombres: "Ana María", apellidos: "Martínez Torres", codigo: "DOC004", esp: "Inglés" },
  { correo: "luis.rodriguez@colegio.edu.co", nombres: "Luis Eduardo", apellidos: "Rodríguez Castro", codigo: "DOC005", esp: "Educación Física" },
  { correo: "diana.torres@colegio.edu.co", nombres: "Diana Patricia", apellidos: "Torres Méndez", codigo: "DOC006", esp: "Ciencias Sociales" }
];

const docentesIds = {};
docentes.forEach((doc, idx) => {
  const id = db.usuarios.insertOne({
    correo: doc.correo,
    rol: "docente",
    nombres: doc.nombres,
    apellidos: doc.apellidos,
    documento: `1012345${idx}`,
    codigo_docente: doc.codigo,
    especialidad: doc.esp,
    telefono: `310${Math.floor(Math.random() * 10000000)}`,
    titulo: "Licenciado",
    fecha_ingreso: ISODate("2020-01-15"),
    activo: true,
    creado_en: Timestamp()
  }).insertedId;
  
  docentesIds[doc.codigo] = id;
});

print("✔ 6 Docentes creados");

// CURSOS
const asignaturas = [
  { nombre: "Matemáticas", codigo: "MAT", area: "matemáticas", creditos: 4, intensidad: 5 },
  { nombre: "Español", codigo: "ESP", area: "lenguaje", creditos: 4, intensidad: 5 },
  { nombre: "Inglés", codigo: "ING", area: "inglés", creditos: 3, intensidad: 4 },
  { nombre: "Ciencias Naturales", codigo: "CIE", area: "ciencias", creditos: 3, intensidad: 4 },
  { nombre: "Ciencias Sociales", codigo: "SOC", area: "sociales", creditos: 3, intensidad: 4 },
  { nombre: "Educación Física", codigo: "EDF", area: "educación_física", creditos: 2, intensidad: 2 }
];

const cursosIds = {};
["10", "11"].forEach(grado => {
  asignaturas.forEach(asig => {
    const codigo = `${asig.codigo}${grado}`;
    const id = db.cursos.insertOne({
      nombre_curso: asig.nombre,
      codigo_curso: codigo,
      grado: grado,
      area: asig.area,
      descripcion: `${asig.nombre} para grado ${grado}°`,
      creditos: NumberInt(asig.creditos),
      intensidad_horaria_semanal: NumberInt(asig.intensidad),
      activo: true,
      creado_en: Timestamp()
    }).insertedId;
    
    cursosIds[codigo] = id;
  });
});

print("✔ 12 Cursos creados");

// GRUPOS
const grupos = [
  { nombre: "10°A", grado: "10", jornada: "mañana", director: "DOC001", capacidad: 40, salon: "Aula 201" },
  { nombre: "10°B", grado: "10", jornada: "mañana", director: "DOC002", capacidad: 38, salon: "Aula 202" },
  { nombre: "11°A", grado: "11", jornada: "mañana", director: "DOC003", capacidad: 35, salon: "Aula 301" },
  { nombre: "11°B", grado: "11", jornada: "mañana", director: "DOC004", capacidad: 35, salon: "Aula 302" }
];

const gruposIds = {};
grupos.forEach(g => {
  const director = db.usuarios.findOne({ codigo_docente: g.director });
  
  const id = db.grupos.insertOne({
    nombre_grupo: g.nombre,
    grado: g.grado,
    jornada: g.jornada,
    anio_lectivo: "2025",
    id_director_grupo: docentesIds[g.director],
    director_info: {
      nombres: director.nombres,
      apellidos: director.apellidos,
      codigo_docente: g.director
    },
    capacidad_max: NumberInt(g.capacidad),
    estudiantes_actuales: NumberInt(0),
    salon_principal: g.salon,
    activo: true,
    creado_en: Timestamp()
  }).insertedId;
  
  gruposIds[g.nombre] = id;
});

print("✔ 4 Grupos creados");

// ESTUDIANTES
const estudiantes = [
  { codigo: "EST001", nombres: "Carlos", apellidos: "Ramírez López", grupo: "10°A", nacimiento: "2010-05-20", acudiente: "Luis Ramírez", tel: "3005551111" },
  { codigo: "EST002", nombres: "Ana", apellidos: "Torres Gómez", grupo: "10°A", nacimiento: "2010-09-12", acudiente: "Marta Torres", tel: "3015552222" },
  { codigo: "EST003", nombres: "Sofía", apellidos: "Méndez Castro", grupo: "10°A", nacimiento: "2010-02-08", acudiente: "Roberto Méndez", tel: "3025553333" },
  { codigo: "EST004", nombres: "Miguel", apellidos: "Santos Díaz", grupo: "10°B", nacimiento: "2010-11-15", acudiente: "Patricia Santos", tel: "3035554444" },
  { codigo: "EST005", nombres: "Laura", apellidos: "González Ruiz", grupo: "10°B", nacimiento: "2010-03-22", acudiente: "Sandra González", tel: "3045555555" },
  { codigo: "EST006", nombres: "David", apellidos: "Martínez Vargas", grupo: "10°B", nacimiento: "2010-07-14", acudiente: "Jorge Martínez", tel: "3055556666" },
  { codigo: "EST007", nombres: "Valentina", apellidos: "López Parra", grupo: "11°A", nacimiento: "2009-01-09", acudiente: "María López", tel: "3065557777" },
  { codigo: "EST008", nombres: "Santiago", apellidos: "Herrera Ortiz", grupo: "11°A", nacimiento: "2009-10-25", acudiente: "Carlos Herrera", tel: "3075558888" },
  { codigo: "EST009", nombres: "Isabella", apellidos: "Castro Rojas", grupo: "11°A", nacimiento: "2009-04-18", acudiente: "Andrea Castro", tel: "3085559999" },
  { codigo: "EST010", nombres: "Andrés", apellidos: "Morales Silva", grupo: "11°B", nacimiento: "2009-12-03", acudiente: "Luis Morales", tel: "3095550000" },
  { codigo: "EST011", nombres: "Camila", apellidos: "Rivera Pérez", grupo: "11°B", nacimiento: "2009-06-21", acudiente: "Patricia Rivera", tel: "3105551111" },
  { codigo: "EST012", nombres: "Juan", apellidos: "Díaz Ramírez", grupo: "11°B", nacimiento: "2009-08-30", acudiente: "Roberto Díaz", tel: "3115552222" }
];

const estudiantesIds = {};
estudiantes.forEach((est, idx) => {
  const id = db.usuarios.insertOne({
    correo: `${est.nombres.toLowerCase()}.${est.apellidos.split(' ')[0].toLowerCase()}@colegio.edu.co`,
    rol: "estudiante",
    nombres: est.nombres,
    apellidos: est.apellidos,
    documento: `100123456${idx}`,
    codigo_est: est.codigo,
    id_grupo: gruposIds[est.grupo],
    fecha_nacimiento: ISODate(est.nacimiento),
    direccion: `Calle ${Math.floor(Math.random() * 50)} #${Math.floor(Math.random() * 50)}-${Math.floor(Math.random() * 100)}`,
    nombre_acudiente: est.acudiente,
    telefono_acudiente: est.tel,
    telefono: `320${Math.floor(Math.random() * 10000000)}`,
    activo: true,
    creado_en: Timestamp()
  }).insertedId;
  
  estudiantesIds[est.codigo] = { id, grupo: est.grupo };
  
  db.grupos.updateOne({ _id: gruposIds[est.grupo] }, { $inc: { estudiantes_actuales: 1 } });
});

print("✔ 12 Estudiantes creados");

// ASIGNACIONES
const asignaciones = [
  { grupo: "10°A", curso: "MAT10", docente: "DOC001" },
  { grupo: "10°A", curso: "ESP10", docente: "DOC002" },
  { grupo: "10°A", curso: "ING10", docente: "DOC004" },
  { grupo: "10°A", curso: "CIE10", docente: "DOC003" },
  { grupo: "10°A", curso: "SOC10", docente: "DOC006" },
  { grupo: "10°A", curso: "EDF10", docente: "DOC005" },
  { grupo: "10°B", curso: "MAT10", docente: "DOC001" },
  { grupo: "10°B", curso: "ESP10", docente: "DOC002" },
  { grupo: "10°B", curso: "ING10", docente: "DOC004" },
  { grupo: "10°B", curso: "CIE10", docente: "DOC003" },
  { grupo: "10°B", curso: "SOC10", docente: "DOC006" },
  { grupo: "10°B", curso: "EDF10", docente: "DOC005" },
  { grupo: "11°A", curso: "MAT11", docente: "DOC001" },
  { grupo: "11°A", curso: "ESP11", docente: "DOC002" },
  { grupo: "11°A", curso: "ING11", docente: "DOC004" },
  { grupo: "11°A", curso: "CIE11", docente: "DOC003" },
  { grupo: "11°A", curso: "SOC11", docente: "DOC006" },
  { grupo: "11°A", curso: "EDF11", docente: "DOC005" },
  { grupo: "11°B", curso: "MAT11", docente: "DOC001" },
  { grupo: "11°B", curso: "ESP11", docente: "DOC002" },
  { grupo: "11°B", curso: "ING11", docente: "DOC004" },
  { grupo: "11°B", curso: "CIE11", docente: "DOC003" },
  { grupo: "11°B", curso: "SOC11", docente: "DOC006" },
  { grupo: "11°B", curso: "EDF11", docente: "DOC005" }
];

const asignacionesIds = {};
asignaciones.forEach(a => {
  const grupo = db.grupos.findOne({ nombre_grupo: a.grupo });
  const curso = db.cursos.findOne({ codigo_curso: a.curso });
  const docente = db.usuarios.findOne({ codigo_docente: a.docente });
  
  const id = db.asignaciones_docentes.insertOne({
    id_grupo: grupo._id,
    id_curso: curso._id,
    id_docente: docente._id,
    periodo: "1",
    anio_lectivo: "2025",
    grupo_info: {
      nombre_grupo: grupo.nombre_grupo,
      grado: grupo.grado,
      jornada: grupo.jornada
    },
    curso_info: {
      nombre_curso: curso.nombre_curso,
      codigo_curso: curso.codigo_curso,
      area: curso.area
    },
    docente_info: {
      nombres: docente.nombres,
      apellidos: docente.apellidos,
      codigo_docente: docente.codigo_docente,
      especialidad: docente.especialidad
    },
    salon_asignado: grupo.salon_principal,
    activo: true,
    creado_en: Timestamp()
  }).insertedId;
  
  asignacionesIds[`${a.grupo}_${a.curso}`] = id;
});

print("✔ 24 Asignaciones creadas");

// MATRÍCULAS CON CALIFICACIONES
Object.entries(estudiantesIds).forEach(([codigo, data]) => {
  const estudiante = db.usuarios.findOne({ codigo_est: codigo });
  const grupo = db.grupos.findOne({ _id: estudiante.id_grupo });
  
  const asignacionesGrupo = db.asignaciones_docentes.find({
    id_grupo: grupo._id,
    periodo: "1"
  }).toArray();
  
  const calificaciones = asignacionesGrupo.map(asig => ({
    id_asignacion: asig._id,
    periodo: "1",
    notas: [
      { tipo: "Parcial", nota: parseFloat((Math.random() * 2 + 3).toFixed(1)), nota_maxima: 5.0, peso: 0.25, fecha_eval: new Date(2025, 0, 10), comentarios: "Primera evaluación" },
      { tipo: "Taller", nota: parseFloat((Math.random() * 2 + 3).toFixed(1)), nota_maxima: 5.0, peso: 0.25, fecha_eval: new Date(2025, 0, 17), comentarios: "Trabajo práctico" },
      { tipo: "Quiz", nota: parseFloat((Math.random() * 2 + 3).toFixed(1)), nota_maxima: 5.0, peso: 0.25, fecha_eval: new Date(2025, 0, 24), comentarios: "Evaluación corta" },
      { tipo: "Proyecto", nota: parseFloat((Math.random() * 2 + 3).toFixed(1)), nota_maxima: 5.0, peso: 0.25, fecha_eval: new Date(2025, 0, 31), comentarios: "Proyecto final" }
    ]
  }));
  
  db.matriculas.insertOne({
    id_estudiante: estudiante._id,
    id_grupo: grupo._id,
    anio_lectivo: "2025",
    fecha_matricula: Timestamp(),
    estado: "activa",
    estudiante_info: {
      nombres: estudiante.nombres,
      apellidos: estudiante.apellidos,
      codigo_est: estudiante.codigo_est,
      documento: estudiante.documento
    },
    grupo_info: {
      nombre_grupo: grupo.nombre_grupo,
      grado: grupo.grado,
      jornada: grupo.jornada
    },
    calificaciones,
    observaciones: "Matrícula regular 2025",
    creado_en: Timestamp()
  });
});

print("✔ 12 Matrículas con calificaciones creadas");

// HORARIOS
const horasClases = ["07:00-08:00", "08:00-09:00", "09:00-10:00", "10:30-11:30", "11:30-12:30"];
const dias = ["lunes", "martes", "miércoles", "jueves", "viernes"];

["10°A", "10°B", "11°A", "11°B"].forEach(nombreGrupo => {
  const grupo = db.grupos.findOne({ nombre_grupo: nombreGrupo });
  const asignacionesGrupo = db.asignaciones_docentes.find({ id_grupo: grupo._id, periodo: "1" }).toArray();
  
  const horario = [];
  let idx = 0;
  
  dias.forEach(dia => {
    horasClases.forEach(hora => {
      const [inicio, fin] = hora.split('-');
      const asig = asignacionesGrupo[idx % asignacionesGrupo.length];
      
      horario.push({
        hora_inicio: inicio,
        hora_fin: fin,
        dia,
        id_curso: asig.id_curso,
        curso_info: {
          nombre_curso: asig.curso_info.nombre_curso,
          codigo_curso: asig.curso_info.codigo_curso,
          docente_nombres: `${asig.docente_info.nombres} ${asig.docente_info.apellidos}`,
          salon: asig.salon_asignado
        }
      });
      
      idx++;
    });
  });
  
  db.horarios.insertOne({
    grupo: nombreGrupo,
    año_lectivo: "2025",
    horario,
    creado_en: Timestamp()
  });
});

print("✔ 4 Horarios creados");

// OBSERVACIONES
const tiposObs = [
  { tipo: "positiva", cat: "academica", desc: "Excelente participación en clase", grav: null },
  { tipo: "positiva", cat: "convivencia", desc: "Demuestra valores de respeto", grav: null },
  { tipo: "negativa", cat: "disciplinaria", desc: "Interrumpe constantemente", grav: "leve" },
  { tipo: "negativa", cat: "academica", desc: "No entrega tareas", grav: "moderada" }
];

Object.values(estudiantesIds).forEach(({ id }) => {
  const estudiante = db.usuarios.findOne({ _id: id });
  const grupo = db.grupos.findOne({ _id: estudiante.id_grupo });
  const asignacionesGrupo = db.asignaciones_docentes.find({ id_grupo: grupo._id }).toArray();
  
  for (let i = 0; i < 2; i++) {
    const obs = tiposObs[Math.floor(Math.random() * tiposObs.length)];
    const asig = asignacionesGrupo[Math.floor(Math.random() * asignacionesGrupo.length)];
    const docente = db.usuarios.findOne({ _id: asig.id_docente });
    
    db.observaciones.insertOne({
      id_estudiante: estudiante._id,
      id_docente: docente._id,
      id_curso: asig.id_curso,
      tipo: obs.tipo,
      categoria: obs.cat,
      descripcion: obs.desc,
      fecha: new Date(2025, Math.floor(Math.random() * 3), Math.floor(Math.random() * 28) + 1),
      seguimiento: obs.tipo === "negativa" ? "Citación programada" : "Felicitación verbal",
      gravedad: obs.grav,
      notificado_acudiente: obs.tipo === "negativa",
      fecha_notificacion: obs.tipo === "negativa" ? new Date() : null,
      estudiante_info: {
        nombres: estudiante.nombres,
        apellidos: estudiante.apellidos,
        codigo_est: estudiante.codigo_est
      },
      docente_info: {
        nombres: docente.nombres,
        apellidos: docente.apellidos,
        especialidad: docente.especialidad
      },
      curso_info: asig.curso_info,
      creado_en: Timestamp()
    });
  }
});

print("✔ 24 Observaciones creadas");

// ASISTENCIA (últimos 5 días)
for (let d = 0; d < 5; d++) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - d);
  
  db.asignaciones_docentes.find({ periodo: "1" }).toArray().forEach(asig => {
    const grupo = db.grupos.findOne({ _id: asig.id_grupo });
    const estudiantes_grupo = db.usuarios.find({ id_grupo: grupo._id, rol: "estudiante" }).toArray();
    
    const registros = estudiantes_grupo.map(est => ({
      id_estudiante: est._id,
      estudiante_info: {
        nombres: est.nombres,
        apellidos: est.apellidos,
        codigo_est: est.codigo_est
      },
      estado: ["presente", "presente", "presente", "ausente", "tarde"][Math.floor(Math.random() * 5)],
      observaciones: ""
    }));
    
    db.asistencia.insertOne({
      id_asignacion: asig._id,
      id_docente: asig.id_docente,
      fecha,
      periodo: "1",
      registros,
      grupo_info: asig.grupo_info,
      curso_info: asig.curso_info,
      creado_en: Timestamp()
    });
  });
}

print("✔ Registros de asistencia creados");

// AUDITORÍA
db.auditoria.insertOne({
  id_usuario: admin,
  accion: "INICIALIZAR_BD_COMPLETA",
  entidad_afectada: "sistema",
  detalles: {
    mensaje: "Base de datos inicializada con estructura completa",
    colecciones: ["usuarios", "grupos", "cursos", "asignaciones_docentes", "horarios", "matriculas", "observaciones", "asistencia"]
  },
  fecha: Timestamp()
});

print("✔ Auditoría registrada");

// ==========================================
//   USUARIO DE KEYCLOAK (AUTO-CREADO)
// ==========================================
print("\n🔐 Configurando usuario de Keycloak...");

// Verificar si ya existe el usuario de Keycloak
const keycloakUser = db.usuarios.findOne({ correo: "carlos.ramirez@colegio.edu.co" });

if (keycloakUser) {
  print("⚠️ Usuario de Keycloak ya existe");
  
  // Verificar si tiene id_grupo
  if (!keycloakUser.id_grupo) {
    print("   Asignando grupo al usuario...");
    
    const grupo10A = db.grupos.findOne({ nombre_grupo: "10°A" });
    
    if (grupo10A) {
      // Asignar grupo
      db.usuarios.updateOne(
        { _id: keycloakUser._id },
        { $set: { id_grupo: grupo10A._id } }
      );
      
      print("   ✔ Grupo 10°A asignado");
      
      // Verificar matrícula
      const matriculaExistente = db.matriculas.findOne({
        id_estudiante: keycloakUser._id,
        anio_lectivo: "2025"
      });
      
      if (!matriculaExistente) {
        print("   Creando matrícula...");
        
        // Obtener asignaciones del grupo
        const asignacionesGrupo = db.asignaciones_docentes.find({
          id_grupo: grupo10A._id,
          periodo: "1"
        }).toArray();
        
        // Generar calificaciones
        const calificaciones = asignacionesGrupo.map(asig => ({
          id_asignacion: asig._id,
          periodo: "1",
          notas: [
            { tipo: "Parcial", nota: parseFloat((Math.random() * 2 + 3).toFixed(1)), nota_maxima: 5.0, peso: 0.25, fecha_eval: new Date(2025, 0, 10), comentarios: "Primera evaluación" },
            { tipo: "Taller", nota: parseFloat((Math.random() * 2 + 3).toFixed(1)), nota_maxima: 5.0, peso: 0.25, fecha_eval: new Date(2025, 0, 17), comentarios: "Trabajo práctico" },
            { tipo: "Quiz", nota: parseFloat((Math.random() * 2 + 3).toFixed(1)), nota_maxima: 5.0, peso: 0.25, fecha_eval: new Date(2025, 0, 24), comentarios: "Evaluación corta" },
            { tipo: "Proyecto", nota: parseFloat((Math.random() * 2 + 3).toFixed(1)), nota_maxima: 5.0, peso: 0.25, fecha_eval: new Date(2025, 0, 31), comentarios: "Proyecto final" }
          ]
        }));
        
        // Crear matrícula
        db.matriculas.insertOne({
          id_estudiante: keycloakUser._id,
          id_grupo: grupo10A._id,
          anio_lectivo: "2025",
          fecha_matricula: Timestamp(),
          estado: "activa",
          estudiante_info: {
            nombres: keycloakUser.nombres,
            apellidos: keycloakUser.apellidos,
            codigo_est: keycloakUser.codigo_est,
            documento: keycloakUser.documento || "1234567890"
          },
          grupo_info: {
            nombre_grupo: grupo10A.nombre_grupo,
            grado: grupo10A.grado,
            jornada: grupo10A.jornada
          },
          calificaciones: calificaciones,
          observaciones: "Matrícula automática desde Keycloak",
          creado_en: Timestamp()
        });
        
        print("   ✔ Matrícula creada con", calificaciones.length, "asignaturas");
        
        // Incrementar contador de estudiantes
        db.grupos.updateOne(
          { _id: grupo10A._id },
          { $inc: { estudiantes_actuales: 1 } }
        );
      } else {
        print("   ✔ Matrícula ya existe");
      }
    } else {
      print("   ❌ ERROR: Grupo 10°A no encontrado");
    }
  } else {
    print("   ✔ Usuario ya tiene grupo asignado");
  }
} else {
  print("   ℹ️ No se encontró usuario de Keycloak (se creará automáticamente al primer login)");
}

print("\n✅ BASE DE DATOS INICIALIZADA COMPLETAMENTE\n");

// Resumen final con verificación de usuario de Keycloak
const totalUsuarios = db.usuarios.countDocuments();
const totalEstudiantes = db.usuarios.countDocuments({ rol: "estudiante" });
const totalDocentes = db.usuarios.countDocuments({ rol: "docente" });
const totalAdmins = db.usuarios.countDocuments({ rol: "administrador" });

print("📊 Resumen de la base de datos:");
print(`   - Total Usuarios: ${totalUsuarios}`);
print(`     • Estudiantes: ${totalEstudiantes}`);
print(`     • Docentes: ${totalDocentes}`);
print(`     • Administradores: ${totalAdmins}`);
print(`   - Grupos: ${db.grupos.countDocuments()}`);
print(`   - Cursos: ${db.cursos.countDocuments()}`);
print(`   - Asignaciones: ${db.asignaciones_docentes.countDocuments()}`);
print(`   - Matrículas: ${db.matriculas.countDocuments()}`);
print(`   - Horarios: ${db.horarios.countDocuments()}`);
print(`   - Observaciones: ${db.observaciones.countDocuments()}`);
print(`   - Asistencias: ${db.asistencia.countDocuments()}`);

// Verificar estudiantes con grupo asignado
const estudiantesSinGrupo = db.usuarios.countDocuments({
  rol: "estudiante",
  id_grupo: { $exists: false }
});

if (estudiantesSinGrupo > 0) {
  print(`\n⚠️  ADVERTENCIA: ${estudiantesSinGrupo} estudiante(s) sin grupo asignado`);
} else {
  print("\n✅ Todos los estudiantes tienen grupo asignado");
}

// Verificar matrículas activas
const matriculasActivas = db.matriculas.countDocuments({ estado: "activa" });
print(`✅ ${matriculasActivas} matrícula(s) activa(s)`);

print("\n🎓 Sistema listo para usar");
print("📧 Credenciales por defecto:");
print("   Admin: admin@colegio.edu.co");
print("   Docente: juan.perez@colegio.edu.co");
print("   Estudiante: carlos.ramirez@colegio.edu.co");
print("   Password: (configurar en Keycloak)\n");