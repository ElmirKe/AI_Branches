package org.example;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Минимальный JSON-парсер и «квотер» строк без внешних зависимостей.
 * Парсит в: Map&lt;String,Object&gt;, List&lt;Object&gt;, String, Double, Boolean, null.
 */
final class Json {

    private Json() {
    }

    static final class ParseException extends RuntimeException {
        ParseException(String message) {
            super(message);
        }
    }

    static Object parse(String text) {
        Parser p = new Parser(text);
        p.skipWs();
        Object value = p.readValue(0);
        p.skipWs();
        if (p.pos != text.length()) {
            throw p.error("Лишние символы после JSON");
        }
        return value;
    }

    /** Превращает строку в JSON-литерал в кавычках с экранированием. */
    static String quote(String s) {
        StringBuilder sb = new StringBuilder(s.length() + 2).append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                case '\b' -> sb.append("\\b");
                case '\f' -> sb.append("\\f");
                default -> {
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.append('"').toString();
    }

    private static final class Parser {
        private static final int MAX_DEPTH = 32;

        private final String s;
        private int pos = 0;

        Parser(String s) {
            this.s = s;
        }

        ParseException error(String what) {
            return new ParseException(what + " (позиция " + pos + ")");
        }

        void skipWs() {
            while (pos < s.length()) {
                char c = s.charAt(pos);
                if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
                    pos++;
                } else {
                    break;
                }
            }
        }

        Object readValue(int depth) {
            if (depth > MAX_DEPTH) {
                throw error("Слишком глубокая вложенность");
            }
            if (pos >= s.length()) {
                throw error("Неожиданный конец JSON");
            }
            char c = s.charAt(pos);
            return switch (c) {
                case '{' -> readObject(depth);
                case '[' -> readArray(depth);
                case '"' -> readString();
                case 't' -> literal("true", Boolean.TRUE);
                case 'f' -> literal("false", Boolean.FALSE);
                case 'n' -> literal("null", null);
                default -> readNumber();
            };
        }

        private Object literal(String word, Object value) {
            if (!s.startsWith(word, pos)) {
                throw error("Ожидалось " + word);
            }
            pos += word.length();
            return value;
        }

        private Double readNumber() {
            int start = pos;
            while (pos < s.length() && "+-0123456789.eE".indexOf(s.charAt(pos)) >= 0) {
                pos++;
            }
            if (start == pos) {
                throw error("Неожиданный символ");
            }
            try {
                return Double.parseDouble(s.substring(start, pos));
            } catch (NumberFormatException e) {
                pos = start;
                throw error("Некорректное число");
            }
        }

        private String readString() {
            pos++; // открывающая кавычка
            StringBuilder sb = new StringBuilder();
            while (true) {
                if (pos >= s.length()) {
                    throw error("Строка не закрыта");
                }
                char c = s.charAt(pos++);
                if (c == '"') {
                    return sb.toString();
                }
                if (c < 0x20) {
                    throw error("Управляющий символ внутри строки");
                }
                if (c != '\\') {
                    sb.append(c);
                    continue;
                }
                if (pos >= s.length()) {
                    throw error("Незавершённая escape-последовательность");
                }
                char e = s.charAt(pos++);
                switch (e) {
                    case '"' -> sb.append('"');
                    case '\\' -> sb.append('\\');
                    case '/' -> sb.append('/');
                    case 'b' -> sb.append('\b');
                    case 'f' -> sb.append('\f');
                    case 'n' -> sb.append('\n');
                    case 'r' -> sb.append('\r');
                    case 't' -> sb.append('\t');
                    case 'u' -> {
                        if (pos + 4 > s.length()) {
                            throw error("Некорректный \\u-код");
                        }
                        try {
                            sb.append((char) Integer.parseInt(s.substring(pos, pos + 4), 16));
                        } catch (NumberFormatException ex) {
                            throw error("Некорректный \\u-код");
                        }
                        pos += 4;
                    }
                    default -> throw error("Неизвестная escape-последовательность");
                }
            }
        }

        private List<Object> readArray(int depth) {
            pos++; // [
            List<Object> out = new ArrayList<>();
            skipWs();
            if (pos < s.length() && s.charAt(pos) == ']') {
                pos++;
                return out;
            }
            while (true) {
                skipWs();
                out.add(readValue(depth + 1));
                skipWs();
                if (pos >= s.length()) {
                    throw error("Массив не закрыт");
                }
                char c = s.charAt(pos++);
                if (c == ']') {
                    return out;
                }
                if (c != ',') {
                    pos--;
                    throw error("Ожидалась запятая или ]");
                }
            }
        }

        private Map<String, Object> readObject(int depth) {
            pos++; // {
            Map<String, Object> out = new LinkedHashMap<>();
            skipWs();
            if (pos < s.length() && s.charAt(pos) == '}') {
                pos++;
                return out;
            }
            while (true) {
                skipWs();
                if (pos >= s.length() || s.charAt(pos) != '"') {
                    throw error("Ожидался ключ в кавычках");
                }
                String key = readString();
                skipWs();
                if (pos >= s.length() || s.charAt(pos) != ':') {
                    throw error("Ожидалось двоеточие");
                }
                pos++;
                skipWs();
                out.put(key, readValue(depth + 1));
                skipWs();
                if (pos >= s.length()) {
                    throw error("Объект не закрыт");
                }
                char c = s.charAt(pos++);
                if (c == '}') {
                    return out;
                }
                if (c != ',') {
                    pos--;
                    throw error("Ожидалась запятая или }");
                }
            }
        }
    }
}
