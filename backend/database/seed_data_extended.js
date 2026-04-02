use colegio;

print("🌱 Insertando datos extendidos de prueba...");

// =====================================
//   INSERTAR MÁS DOCENTES
// =====================================

const docente4 = db.usuarios.insertOne({
  correo: "ana.martinez@colegio.edu.co",
  rol: "docente",
  nombres: "Ana",
  apellidos: "Martínez",
  telefono: "3135555555",
  documento: "10456789",
  codigo_empleado: "DOC004",
  especialidad: "Inglés",
  fecha_ingreso: ISODate("2020-08-01"),
  activo: true,
  creado_en: Timestamp()
}).insertedId;

const docente5 = db.usuarios.insertOne({
  correo: "luis.rodriguez@colegio.edu.co",
  rol: "docente",
  nombres: "Luis",
  apellidos: "Rodríguez",
  telefono: "3145556666",
  documento: "10567890",
  codigo_empleado: "DOC005",
  especialidad: "Educación Física",
  fecha_ingreso: ISODate("2021-01-15"),
  activo: true,
  creado_en: Timestamp()
}).insertedId;

const docente6 = db.usuarios.insertOne({
  correo: "diana.torres@colegio.edu.co",
  rol: "docente",
  nombres: "Diana",
  apellidos: "Torres",
  telefono: "3155557777",
  documento: "10678901",
  codigo_empleado: "DOC006",
  especialidad: "Arte",
  fecha_ingreso: ISODate("2019-06-10"),
  activo: true,
  creado_en: Timestamp()
}).insertedId;

print("✔ 3 Docentes adicionales creados");

// =====================================
//   INSERTAR MÁS ESTUDIANTES
// =====================================

const estudiante5 = db.usuarios.insertOne({
  correo: "laura.gonzalez@colegio.edu.co",
  rol: "estudiante",
  nombres: "Laura",
  apellidos: "González",
  documento: "1001234571",
  codigo_est: "EST005",
  fecha_nacimiento: ISODate("2010-03-22"),
  direccion: "Calle 12 #18-25",
  nombre_acudiente: "Sandra González",
  telefono_acudiente: "3045555555",
  activo: true,
  creado_en: Timestamp()
}).insertedId;

const estudiante6 = db.usuarios.insertOne({
  correo: "david.martinez@colegio.edu.co",
  rol: "estudiante",
  nombres: "David",
  apellidos: "Martínez",
  documento: "1001234572",
  codigo_est: "EST006",
  fecha_nacimiento: ISODate("2010-07-14"),
  direccion: "Av 7 #22-30",
  nombre_acudiente: "Jorge Martínez",
  telefono_acudiente: "3055556666",
  activo: true,
  creado_en: Timestamp()
}).insertedId;

const estudiante7 = db.usuarios.insertOne({
  correo: "valentina.lopez@colegio.edu.co",
  rol: "estudiante",
  nombres: "Valentina",
  apellidos: "López",
  documento: "1001234573",
  codigo_est: "EST007",
  fecha_nacimiento: ISODate("2011-01-09"),
  direccion: "Cra 15 #10-12",
  nombre_acudiente: "María López",
  telefono_acudiente: "3065557777",
  activo: true,
  creado_en: Timestamp()
}).insertedId;

const estudiante8 = db.usuarios.insertOne({
  correo: "santiago.herrera@colegio.edu.co",
  rol: "estudiante",
  nombres: "Santiago",
  apellidos: "Herrera",
  documento: "1001234574",
  codigo_est: "EST008",
  fecha_nacimiento: ISODate("2010-10-25"),
  direccion: "Calle 20 #5-40",
  nombre_acudiente: "Carlos Herrera",
  telefono_acudiente: "3075558888",
  activo: true,
  creado_en: Timestamp()
}).insertedId;

const estudiante9 = db.usuarios.insertOne({
  correo: "isabella.castro@colegio.edu.co",
  rol: "estudiante",
  nombres: "Isabella",
  apellidos: "Castro",
  documento: "1001234575",
  codigo_est: "EST009",
  fecha_nacimiento: ISODate("2011-04-18"),
  direccion: "Av 10 #30-15",
  nombre_acudiente: "Andrea Castro",
  telefono_acudiente: "3085559999",
  activo: true,
  creado_en: Timestamp()
}).insertedId;

const estudiante10 = db.usuarios.insertOne({
  correo: "andres.morales@colegio.edu.co",
  rol: "estudiante",
  nombres: "Andrés",
  apellidos: "Morales",
  documento: "1001234576",
  codigo_est: "EST010",
  fecha_nacimiento: ISODate("2010-12-03"),
  direccion: "Cra 8 #14-28",
  nombre_acudiente: "Luis Morales",
  telefono_acudiente: "3095550000",
  activo: true,
  creado_en: Timestamp()
}).insertedId;

const estudiante11 = db.usuarios.insertOne({
  correo: "camila.rivera@colegio.edu.co",
  rol: "estudiante",
  nombres: "Camila",
  apellidos: "Rivera",
  documento: "1001234577",
  codigo_est: "EST011",
  fecha_nacimiento: ISODate("2011-06-21"),
  direccion: "Calle 25 #12-35",
  nombre_acudiente: "Patricia Rivera",
  telefono_acudiente: "3105551111",
  activo: true,
  creado_en: Timestamp()
}).insertedId;

const estudiante12 = db.usuarios.insertOne({
  correo: "juan.diaz@colegio.edu.co",
  rol: "estudiante",
  nombres: "Juan",
  apellidos: "Díaz",
  documento: "1001234578",
  codigo_est: "EST012",
  fecha_nacimiento: ISODate("2010-08-30"),
  direccion: "Av 12 #20-18",
  nombre_acudiente: "Roberto Díaz",
  telefono_acudiente: "3115552222",
  activo: true,
  creado_en: Timestamp()
}).insertedId;

print("✔ 8 Estudiantes adicionales creados (Total: 12)");

// =====================================
//   🔧 BUSCAR ESTUDIANTES EXISTENTES
// =====================================

// Buscar estudiantes del seed_data.js
const estudiante1 = db.usuarios.findOne({codigo_est: "EST001"})._id;
const estudiante2 = db.usuarios.findOne({codigo_est: "EST002"})._id;
const estudiante3 = db.usuarios.findOne({codigo_est: "EST003"})._id;
const estudiante4 = db.usuarios.findOne({codigo_est: "EST004"})._id;

print("✔ Estudiantes existentes recuperados");

// =====================================
//   INSERTAR MÁS CURSOS
// =====================================

// Obtener docentes ya existentes
const docente1 = db.usuarios.findOne({correo: "juan.perez@colegio.edu.co"})._id;
const docente2 = db.usuarios.findOne({correo: "maria.lopez@colegio.edu.co"})._id;
const docente3 = db.usuarios.findOne({correo: "carlos.garcia@colegio.edu.co"})._id;

print("✔ Docentes existentes recuperados");

// Cursos de María López (profesor1 en Keycloak)
const curso5 = db.cursos.insertOne({
  nombre_curso: "Español 11° A",
  codigo_curso: "ESP11A",
  id_docente: docente2,
  grado: "11",
  periodo: "1",
  capacidad_max: NumberInt(35),
  activo: true,
  docente_info: {
    nombres: "María",
    apellidos: "López",
    especialidad: "Español"
  }
}).insertedId;

const curso6 = db.cursos.insertOne({
  nombre_curso: "Español 10° B",
  codigo_curso: "ESP10B",
  id_docente: docente2,
  grado: "10",
  periodo: "1",
  capacidad_max: NumberInt(38),
  activo: true,
  docente_info: {
    nombres: "María",
    apellidos: "López",
    especialidad: "Español"
  }
}).insertedId;

const curso7 = db.cursos.insertOne({
  nombre_curso: "Literatura 11° A",
  codigo_curso: "LIT11A",
  id_docente: docente2,
  grado: "11",
  periodo: "1",
  capacidad_max: NumberInt(35),
  activo: true,
  docente_info: {
    nombres: "María",
    apellidos: "López",
    especialidad: "Español"
  }
}).insertedId;

// Cursos de Juan Pérez
const curso8 = db.cursos.insertOne({
  nombre_curso: "Matemáticas 11° A",
  codigo_curso: "MAT11A",
  id_docente: docente1,
  grado: "11",
  periodo: "1",
  capacidad_max: NumberInt(35),
  activo: true,
  docente_info: {
    nombres: "Juan",
    apellidos: "Pérez",
    especialidad: "Matemáticas"
  }
}).insertedId;

const curso9 = db.cursos.insertOne({
  nombre_curso: "Álgebra 10° B",
  codigo_curso: "ALG10B",
  id_docente: docente1,
  grado: "10",
  periodo: "1",
  capacidad_max: NumberInt(38),
  activo: true,
  docente_info: {
    nombres: "Juan",
    apellidos: "Pérez",
    especialidad: "Matemáticas"
  }
}).insertedId;

// Cursos de Carlos García
const curso10 = db.cursos.insertOne({
  nombre_curso: "Ciencias 11° A",
  codigo_curso: "CIE11A",
  id_docente: docente3,
  grado: "11",
  periodo: "1",
  capacidad_max: NumberInt(35),
  activo: true,
  docente_info: {
    nombres: "Carlos",
    apellidos: "García",
    especialidad: "Ciencias"
  }
}).insertedId;

// Cursos de Ana Martínez
const curso11 = db.cursos.insertOne({
  nombre_curso: "Inglés 10° A",
  codigo_curso: "ING10A",
  id_docente: docente4,
  grado: "10",
  periodo: "1",
  capacidad_max: NumberInt(40),
  activo: true,
  docente_info: {
    nombres: "Ana",
    apellidos: "Martínez",
    especialidad: "Inglés"
  }
}).insertedId;

const curso12 = db.cursos.insertOne({
  nombre_curso: "Inglés 11° A",
  codigo_curso: "ING11A",
  id_docente: docente4,
  grado: "11",
  periodo: "1",
  capacidad_max: NumberInt(35),
  activo: true,
  docente_info: {
    nombres: "Ana",
    apellidos: "Martínez",
    especialidad: "Inglés"
  }
}).insertedId;

// Cursos de Luis Rodríguez
const curso13 = db.cursos.insertOne({
  nombre_curso: "Educación Física 10° A",
  codigo_curso: "EDF10A",
  id_docente: docente5,
  grado: "10",
  periodo: "1",
  capacidad_max: NumberInt(45),
  activo: true,
  docente_info: {
    nombres: "Luis",
    apellidos: "Rodríguez",
    especialidad: "Educación Física"
  }
}).insertedId;

print("✔ 9 Cursos adicionales creados (Total: 13)");

// =====================================
//   INSERTAR MATRÍCULAS CON CALIFICACIONES
// =====================================

// Función helper para generar calificaciones aleatorias
// Reemplazar esta función (línea ~360):
// Reemplazar la función generarCalificaciones() completamente (línea ~347):

// ✅ GENERAR CALIFICACIONES CON PERIODO
function generarCalificaciones() {
  const tipos = ["Parcial", "Taller", "Quiz"];
  const calificaciones = [];
  
  // ✅ Generar calificaciones para cada periodo
  for (let periodo = 1; periodo <= 4; periodo++) {
    tipos.forEach((tipo, index) => {
      const nota = Math.random() * 2 + 3; // Entre 3.0 y 5.0
      calificaciones.push({
        tipo: tipo,
        nota: Number(nota.toFixed(1)),
        nota_maxima: Number(5.0),
        peso: Number(0.33),
        periodo: String(periodo),  // ✅ AGREGAR PERIODO
        fecha_eval: new Date(2025, periodo - 1, 5 + (index * 15)), // Fechas distribuidas
        comentarios: nota >= 4.0 ? "Buen desempeño" : "Debe reforzar"
      });
    });
  }
  
  return calificaciones;
}
print("✔ Función generarCalificaciones() con periodos definida");

// Matricular estudiantes en Español 11° A (María López)
const estudiantesESP11A = [estudiante5, estudiante6, estudiante7, estudiante8, estudiante9, estudiante10];

estudiantesESP11A.forEach((estudianteId) => {
  const estudiante = db.usuarios.findOne({_id: estudianteId});
  db.matriculas.insertOne({
    id_estudiante: estudianteId,
    id_curso: curso5,
    fecha_matricula: Timestamp(),
    estado: "activo",
    calificaciones: generarCalificaciones(),
    estudiante_info: {
      nombres: estudiante.nombres,
      apellidos: estudiante.apellidos,
      codigo_est: estudiante.codigo_est
    },
    curso_info: {
      nombre_curso: "Español 11° A",
      codigo_curso: "ESP11A",
      grado: "11",
      periodo: "1"
    }
  });
});

print("✔ Matrículas creadas para Español 11° A");

// Matricular estudiantes en Español 10° B (María López)
const estudiantesESP10B = [estudiante1, estudiante2, estudiante11, estudiante12];

estudiantesESP10B.forEach((estudianteId) => {
  const estudiante = db.usuarios.findOne({_id: estudianteId});
  db.matriculas.insertOne({
    id_estudiante: estudianteId,
    id_curso: curso6,
    fecha_matricula: Timestamp(),
    estado: "activo",
    calificaciones: generarCalificaciones(),
    estudiante_info: {
      nombres: estudiante.nombres,
      apellidos: estudiante.apellidos,
      codigo_est: estudiante.codigo_est
    },
    curso_info: {
      nombre_curso: "Español 10° B",
      codigo_curso: "ESP10B",
      grado: "10",
      periodo: "1"
    }
  });
});

print("✔ Matrículas creadas para Español 10° B");

// Matricular estudiantes en Literatura 11° A (María López)
const estudiantesLIT11A = [estudiante5, estudiante6, estudiante7, estudiante8];

estudiantesLIT11A.forEach((estudianteId) => {
  const estudiante = db.usuarios.findOne({_id: estudianteId});
  db.matriculas.insertOne({
    id_estudiante: estudianteId,
    id_curso: curso7,
    fecha_matricula: Timestamp(),
    estado: "activo",
    calificaciones: generarCalificaciones(),
    estudiante_info: {
      nombres: estudiante.nombres,
      apellidos: estudiante.apellidos,
      codigo_est: estudiante.codigo_est
    },
    curso_info: {
      nombre_curso: "Literatura 11° A",
      codigo_curso: "LIT11A",
      grado: "11",
      periodo: "1"
    }
  });
});

print("✔ Matrículas creadas para Literatura 11° A");

// Matricular en Matemáticas 11° A (Juan Pérez)
const estudiantesMAT11A = [estudiante5, estudiante6, estudiante7, estudiante9, estudiante10];

estudiantesMAT11A.forEach((estudianteId) => {
  const estudiante = db.usuarios.findOne({_id: estudianteId});
  db.matriculas.insertOne({
    id_estudiante: estudianteId,
    id_curso: curso8,
    fecha_matricula: Timestamp(),
    estado: "activo",
    calificaciones: generarCalificaciones(),
    estudiante_info: {
      nombres: estudiante.nombres,
      apellidos: estudiante.apellidos,
      codigo_est: estudiante.codigo_est
    },
    curso_info: {
      nombre_curso: "Matemáticas 11° A",
      codigo_curso: "MAT11A",
      grado: "11",
      periodo: "1"
    }
  });
});

print("✔ Matrículas creadas para Matemáticas 11° A");

// Matricular en Inglés 10° A (Ana Martínez)
const estudiantesING10A = [estudiante1, estudiante2, estudiante3, estudiante4, estudiante11, estudiante12];

estudiantesING10A.forEach((estudianteId) => {
  const estudiante = db.usuarios.findOne({_id: estudianteId});
  db.matriculas.insertOne({
    id_estudiante: estudianteId,
    id_curso: curso11,
    fecha_matricula: Timestamp(),
    estado: "activo",
    calificaciones: generarCalificaciones(),
    estudiante_info: {
      nombres: estudiante.nombres,
      apellidos: estudiante.apellidos,
      codigo_est: estudiante.codigo_est
    },
    curso_info: {
      nombre_curso: "Inglés 10° A",
      codigo_curso: "ING10A",
      grado: "10",
      periodo: "1"
    }
  });
});

print("✔ Matrículas creadas para Inglés 10° A");

// =====================================
//   AUDITORÍA
// =====================================

const adminUser = db.usuarios.findOne({correo: "admin@colegio.edu.co"});

if (adminUser) {
  db.auditoria.insertOne({
    id_usuario: adminUser._id,
    accion: "AMPLIAR_BD",
    entidad_afectada: "sistema",
    detalles: { mensaje: "Datos extendidos insertados correctamente" },
    fecha: Timestamp()
  });
  print("✔ Registro de auditoría creado");
} else {
  print("⚠️ Usuario admin no encontrado, auditoría omitida");
}

print("\n✅ Datos extendidos insertados correctamente");
print("\n📊 Resumen Total:");
print("   - Usuarios totales: " + db.usuarios.countDocuments());
print("   - Docentes: " + db.usuarios.countDocuments({rol: "docente"}));
print("   - Estudiantes: " + db.usuarios.countDocuments({rol: "estudiante"}));
print("   - Cursos totales: " + db.cursos.countDocuments());
print("   - Matrículas totales: " + db.matriculas.countDocuments());
print("\n🎓 Distribución por docente:");
print("   - María López: " + db.cursos.countDocuments({codigo_curso: {$regex: /^(ESP|LIT)/}}) + " cursos");
print("   - Juan Pérez: " + db.cursos.countDocuments({codigo_curso: {$regex: /^(MAT|ALG)/}}) + " cursos");
print("   - Carlos García: " + db.cursos.countDocuments({codigo_curso: {$regex: /^CIE/}}) + " cursos");
print("   - Ana Martínez: " + db.cursos.countDocuments({codigo_curso: {$regex: /^ING/}}) + " cursos");
print("   - Luis Rodríguez: " + db.cursos.countDocuments({codigo_curso: {$regex: /^EDF/}}) + " cursos");

print("\n📚 Distribución de matrículas por curso:");
db.matriculas.aggregate([
  { $group: { _id: "$curso_info.nombre_curso", total: { $sum: 1 } } },
  { $sort: { total: -1 } }
]).forEach(function(doc) {
  print("   - " + doc._id + ": " + doc.total + " estudiantes");
});