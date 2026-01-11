/**
 * Process Manager for handling long-running processes
 * Provides cancellation and monitoring capabilities
 */

interface ProcessInfo {
  processId: string;
  type: 'epvs' | 'excel' | 'proposal' | 'survey';
  startTime: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  opportunityId?: string;
}

class ProcessManager {
  private activeProcesses: Map<string, ProcessInfo> = new Map();
  private cancellationTokens: Map<string, AbortController> = new Map();

  /**
   * Start a new process
   */
  startProcess(
    processId: string, 
    type: ProcessInfo['type'], 
    opportunityId?: string
  ): AbortController {
    const abortController = new AbortController();
    
    const processInfo: ProcessInfo = {
      processId,
      type,
      startTime: Date.now(),
      status: 'running',
      opportunityId
    };

    this.activeProcesses.set(processId, processInfo);
    this.cancellationTokens.set(processId, abortController);

    console.log(`🔧 ProcessManager: Started process ${processId} (type: ${type})`);
    return abortController;
  }

  /**
   * Complete a process
   */
  completeProcess(processId: string, status: 'completed' | 'failed' = 'completed'): void {
    const process = this.activeProcesses.get(processId);
    if (process) {
      process.status = status;
      console.log(`🔧 ProcessManager: Completed process ${processId} with status: ${status}`);
    }

    // Clean up cancellation token
    this.cancellationTokens.delete(processId);
  }

  /**
   * Cancel a process
   */
  cancelProcess(processId: string): boolean {
    const process = this.activeProcesses.get(processId);
    const abortController = this.cancellationTokens.get(processId);

    if (!process || !abortController) {
      console.warn(`🔧 ProcessManager: Process ${processId} not found for cancellation`);
      return false;
    }

    if (process.status !== 'running') {
      console.warn(`🔧 ProcessManager: Process ${processId} is not running, cannot cancel`);
      return false;
    }

    // Abort the request
    abortController.abort();
    
    // Update process status
    process.status = 'cancelled';
    
    // Clean up
    this.cancellationTokens.delete(processId);
    
    console.log(`🔧 ProcessManager: Cancelled process ${processId}`);
    return true;
  }

  /**
   * Get process info
   */
  getProcess(processId: string): ProcessInfo | undefined {
    return this.activeProcesses.get(processId);
  }

  /**
   * Get all active processes
   */
  getActiveProcesses(): ProcessInfo[] {
    return Array.from(this.activeProcesses.values())
      .filter(process => process.status === 'running');
  }

  /**
   * Get processes by type
   */
  getProcessesByType(type: ProcessInfo['type']): ProcessInfo[] {
    return Array.from(this.activeProcesses.values())
      .filter(process => process.type === type);
  }

  /**
   * Get processes by opportunity ID
   */
  getProcessesByOpportunity(opportunityId: string): ProcessInfo[] {
    return Array.from(this.activeProcesses.values())
      .filter(process => process.opportunityId === opportunityId);
  }

  /**
   * Check if a process is running
   */
  isProcessRunning(processId: string): boolean {
    const process = this.activeProcesses.get(processId);
    return process ? process.status === 'running' : false;
  }

  /**
   * Get cancellation signal for a process
   */
  getCancellationSignal(processId: string): AbortSignal | undefined {
    const abortController = this.cancellationTokens.get(processId);
    return abortController?.signal;
  }

  /**
   * Remove a process (cleanup)
   */
  removeProcess(processId: string): void {
    this.activeProcesses.delete(processId);
    this.cancellationTokens.delete(processId);
    console.log(`🔧 ProcessManager: Removed process ${processId}`);
  }

  /**
   * Clean up completed processes older than specified time
   */
  cleanupCompletedProcesses(maxAge: number = 5 * 60 * 1000): void { // 5 minutes default
    const now = Date.now();
    const toRemove: string[] = [];

    for (const [processId, process] of this.activeProcesses.entries()) {
      if (process.status !== 'running' && (now - process.startTime) > maxAge) {
        toRemove.push(processId);
      }
    }

    toRemove.forEach(processId => {
      this.removeProcess(processId);
    });

    if (toRemove.length > 0) {
      console.log(`🔧 ProcessManager: Cleaned up ${toRemove.length} completed processes`);
    }
  }

  /**
   * Cancel all processes of a specific type
   */
  cancelAllProcessesOfType(type: ProcessInfo['type']): number {
    const processes = this.getProcessesByType(type);
    let cancelledCount = 0;

    processes.forEach(process => {
      if (this.cancelProcess(process.processId)) {
        cancelledCount++;
      }
    });

    console.log(`🔧 ProcessManager: Cancelled ${cancelledCount} processes of type ${type}`);
    return cancelledCount;
  }

  /**
   * Cancel all processes for a specific opportunity
   */
  cancelAllProcessesForOpportunity(opportunityId: string): number {
    const processes = this.getProcessesByOpportunity(opportunityId);
    let cancelledCount = 0;

    processes.forEach(process => {
      if (this.cancelProcess(process.processId)) {
        cancelledCount++;
      }
    });

    console.log(`🔧 ProcessManager: Cancelled ${cancelledCount} processes for opportunity ${opportunityId}`);
    return cancelledCount;
  }

  /**
   * Get process count
   */
  getProcessCount(): number {
    return this.activeProcesses.size;
  }

  /**
   * Get active process count
   */
  getActiveProcessCount(): number {
    return this.getActiveProcesses().length;
  }
}

// Export singleton instance
export const processManager = new ProcessManager();

// Export types
export type { ProcessInfo };
