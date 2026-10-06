package org.example;

public class ChatSession {

    private int currentBranchId;

    public ChatSession(int startBranchId) {
        this.currentBranchId = startBranchId;
    }

    public int getCurrentBranchId() {
        return currentBranchId;
    }

    public void switchBranch(int branchId) {
        this.currentBranchId = branchId;
    }
}