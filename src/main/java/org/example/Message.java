package org.example;

import java.util.List;

public class Message {

    private final int id;
    private final int branchId;
    private final String role;
    private final String content;
    /** картинки к сообщению: data:image/...;base64 или https-ссылки */
    private final List<String> images;

    public Message(
            int id,
            int branchId,
            String role,
            String content
    ) {
        this.id = id;
        this.branchId = branchId;
        this.role = role;
        this.content = content;
        this.images = List.of();
    }

    public Message(int id, int branchId, String role, String content, List<String> images) {
        this.id = id;
        this.branchId = branchId;
        this.role = role;
        this.content = content;
        this.images = images == null ? List.of() : List.copyOf(images);
    }

    public List<String> getImages() {
        return images;
    }

    public int getId() {
        return id;
    }

    public int getBranchId() {
        return branchId;
    }

    public String getRole() {
        return role;
    }

    public String getContent() {
        return content;
    }

    @Override
    public String toString() {
        return role + ": " + content;
    }
}