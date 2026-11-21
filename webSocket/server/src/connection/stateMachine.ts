import { ConnectionStatus } from './connectionPool';

export type StateTransition = {
  from: ConnectionStatus;
  to: ConnectionStatus;
  action?: () => void;
};

export class ConnectionStateMachine {
  private currentState: ConnectionStatus;
  
  private transitions: Map<ConnectionStatus, ConnectionStatus[]> = new Map([
    [ConnectionStatus.CONNECTING, [ConnectionStatus.OPEN, ConnectionStatus.CLOSED]],
    [ConnectionStatus.OPEN, [ConnectionStatus.CLOSING]],
    [ConnectionStatus.CLOSING, [ConnectionStatus.CLOSED]],
    [ConnectionStatus.CLOSED, []]
  ]);

  constructor(initialState: ConnectionStatus = ConnectionStatus.CONNECTING) {
    this.currentState = initialState;
  }

  getState(): ConnectionStatus {
    return this.currentState;
  }

  transitionTo(newState: ConnectionStatus): boolean {
    const allowedTransitions = this.transitions.get(this.currentState);
    if (!allowedTransitions || !allowedTransitions.includes(newState)) {
      return false;
    }
    
    this.currentState = newState;
    return true;
  }

  canTransitionTo(newState: ConnectionStatus): boolean {
    const allowedTransitions = this.transitions.get(this.currentState);
    return allowedTransitions ? allowedTransitions.includes(newState) : false;
  }

  isOpen(): boolean {
    return this.currentState === ConnectionStatus.OPEN;
  }

  isClosed(): boolean {
    return this.currentState === ConnectionStatus.CLOSED;
  }

  isClosing(): boolean {
    return this.currentState === ConnectionStatus.CLOSING;
  }

  reset(): void {
    this.currentState = ConnectionStatus.CONNECTING;
  }
}

export class StateMachineManager {
  private machines: Map<string, ConnectionStateMachine> = new Map();

  create(connectionId: string): ConnectionStateMachine {
    const machine = new ConnectionStateMachine();
    this.machines.set(connectionId, machine);
    return machine;
  }

  get(connectionId: string): ConnectionStateMachine | undefined {
    return this.machines.get(connectionId);
  }

  transition(connectionId: string, newState: ConnectionStatus): boolean {
    const machine = this.machines.get(connectionId);
    if (!machine) return false;
    return machine.transitionTo(newState);
  }

  getState(connectionId: string): ConnectionStatus | undefined {
    const machine = this.machines.get(connectionId);
    return machine ? machine.getState() : undefined;
  }

  remove(connectionId: string): void {
    this.machines.delete(connectionId);
  }

  clear(): void {
    this.machines.clear();
  }
}
