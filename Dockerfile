FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q dependency:copy-dependencies -DoutputDirectory=/app/lib -Dmaven.compiler.release=17
COPY src ./src
RUN mvn -q compile -Dmaven.compiler.release=17

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/lib ./lib
COPY --from=build /app/target/classes ./classes
CMD ["java", "-cp", "classes:lib/*", "org.example.Main"]
