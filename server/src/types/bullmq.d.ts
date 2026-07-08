declare module 'bullmq' {
  export class Queue {
    constructor(name: string, options?: any);
    add(name: string, data: any, options?: any): Promise<any>;
    close(): Promise<void>;
  }
  export class Worker {
    constructor(name: string, processor: (job: any) => Promise<any>, options?: any);
    close(): Promise<void>;
  }
}
