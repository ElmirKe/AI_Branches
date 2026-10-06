export type Role = "user" | "assistant";

export interface Message {
  id: string;
  parents: string[]; // обычно один родитель; несколько — только у узла-слияния
  role: Role;
  branch: string; // имя ветки
  text: string;
  pending?: boolean;
  /** ответ не удалось получить: текст — сообщение об ошибке, в контекст ИИ не попадает */
  error?: boolean;
}

export interface ChatTree {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
}

export type Theme = "light" | "dark";
