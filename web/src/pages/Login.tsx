// web/src/pages/Login.tsx
import  { useState } from 'react';
import { signIn } from '../services/auth'; // adjust path
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const nav = useNavigate();

  async function onSignIn(){
    try{
      await signIn(email,password);
      nav('/');
    }catch(err:any){
      alert(err?.message || err);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white p-6 rounded-xl shadow">
        <h1 className="text-xl font-semibold mb-4">Sign in</h1>
        <input className="w-full p-3 border rounded mb-3" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" />
        <input className="w-full p-3 border rounded mb-3" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" />
        <button onClick={onSignIn} className="w-full bg-primary text-white py-3 rounded">Sign in</button>
      </div>
    </div>
  );
}
