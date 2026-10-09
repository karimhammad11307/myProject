export class ApiError extends Error {constructor(public status:number,message:string){super(message);}}
export async function post<T=Record<string,unknown>>(path:string,body:unknown):Promise<T> {
  let response:Response;try{response=await fetch(`/api/${path}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});}catch{throw new ApiError(0,"Connection lost. Your draft has not been confirmed saved. Reconnect and retry.");}
  const value=await response.json();if(!response.ok) throw new ApiError(response.status,value.error || "Unable to save. Please retry.");return value;
}
