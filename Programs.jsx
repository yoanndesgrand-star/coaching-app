import { useState } from 'react'

export default function Programs({ onBack }) {
  var [msg, setMsg] = useState('Programmes — version test')
  return (
    <div style={{padding:40,textAlign:'center'}}>
      <button onClick={onBack} style={{background:'none',border:'none',color:'#7a7065',fontSize:12,cursor:'pointer',marginBottom:20}}>← Retour</button>
      <div style={{fontSize:20}}>{msg}</div>
      <div style={{marginTop:20,color:'#7a7065'}}>Si tu vois ce message, le problème est dans le code Programs, pas dans l'import.</div>
    </div>
  )
}
