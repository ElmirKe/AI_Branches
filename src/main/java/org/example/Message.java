package org.example;

public class Message {

    private final int id;
    private final int branchId;
    private final String role;
    private final String content;

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