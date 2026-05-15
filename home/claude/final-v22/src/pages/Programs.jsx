import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import WorkoutPlayer from '../components/WorkoutPlayer'
import CircuitPlayer from '../components/CircuitPlayer'
import { SwipeRow, LongPressMenu, InfoBubble, OnboardingGuide } from '../components/UXComponents'
import ProgressionChart from '../components/ProgressionChart'

// Affiche la première frame d'un GIF (image statique)
function FrozenImg({ src, style }) {
  var ref = useRef(null)
  useEffect(function() {
    if (!src || !ref.current) return
    var img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = function() {
      var c = ref.current
      if (!c) return
      var w = parseInt(style.width) || 40
      var h = parseInt(style.height) || 40
      c.width = w
      c.height = h
      var ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0, w, h)
    }
    img.src = src
  }, [src])
  return <canvas ref={ref} style={Object.assign({}, style, { display: 'block' })} />
}

var GOLD = '#C4973A'
var DEFAULT_MUSCLES = ['Abdominaux','Biceps','Cardio','Dos','Épaules','Fessiers','Full body','Gainage','Ischio-jambiers','Mollets','Pectoraux','Quadriceps','Triceps','Autre']
var EQUIPMENT = ['Barre','Élastique','Haltères','Kettlebell','Machine','Poids de corps','Poulie','TRX','Autre']
function norm(s){return(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}

export default function Programs({ onBack, coachMode, coachClientId, coachClientName, clients, setCoachClient, coachId, isSuperAdmin, onEditingChange, onLiveTraining, liveTrainingActive, profile }) {
  var [view, setView] = useState(coachMode ? 'coach-select' : 'home')
  var [exercises, setExercises] = useState([])
  var [programs, setPrograms] = useState([])
  var [clients, setClients] = useState([])
  var [msg, setMsg] = useState(null)
  var [loading, setLoading] = useState(true)
  var [exForm, setExForm] = useState({name:'',muscle_group:'',secondary_muscle:'',equipment:'',description:'',tips:'',custom_sections:[],gif_url:'',video_url:'',allow_bodyweight:false})
  var [techSteps, setTechSteps] = useState([''])
  var [editingEx, setEditingEx] = useState(null)
  var [exFilter, setExFilter] = useState('')
  var [exEquipFilter, setExEquipFilter] = useState('')
  var [exSearch, setExSearch] = useState('')
  var [selectedExIds, setSelectedExIds] = useState({})
  var [uploading, setUploading] = useState(false)
  var [progForm, setProgForm] = useState({name:'',description:''})
  var [editingProg, setEditingProg] = useState(null)
  var [sessions, setSessions] = useState([])
  var [activeSession, setActiveSession] = useState(0)
  var [leaveConfirm, setLeaveConfirm] = useState(null)
  var [liveClient, setLiveClient] = useState('')
  var [liveWorkout, setLiveWorkout] = useState(false)
  var [liveSaveModal, setLiveSaveModal] = useState(false)
  var [showAddEx, setShowAddEx] = useState(false)
  var [insertAtIdx, setInsertAtIdx] = useState(null)
  var [zoomImg, setZoomImg] = useState(null) // null = append at end, number = insert after this index
  var [altEditIdx, setAltEditIdx] = useState(null)
  var [altList, setAltList] = useState([])
  var [searchQ, setSearchQ] = useState('')
  var [progExMuscle, setProgExMuscle] = useState('')
  var [progExEquip, setProgExEquip] = useState('')
  var [equipQ, setEquipQ] = useState('')
  var [assignProg, setAssignProg] = useState(null)
  var [assignClient, setAssignClient] = useState('')
  var [playerSession, setPlayerSession] = useState(null)
  var [playerClientId, setPlayerClientId] = useState(null)
  var [workoutHistory, setWorkoutHistory] = useState([])
  var [selectedWorkout, setSelectedWorkout] = useState(null)
  var [workoutDetail, setWorkoutDetail] = useState([])
  var [clientAssignedProgs, setClientAssignedProgs] = useState([])
  var [videoFolders, setVideoFolders] = useState([])
  var [activeFolder, setActiveFolder] = useState(null)
  var [videoForm, setVideoForm] = useState({title:'',youtube_url:''})
  var [savedBlocks, setSavedBlocks] = useState([])
  var [showInsertBlock, setShowInsertBlock] = useState(false)
  var [showSaveBlock, setShowSaveBlock] = useState(false)
  var [saveBlockName, setSaveBlockName] = useState('')
  var [longMenu, setLongMenu] = useState(null)
  var [detailEx, setDetailEx] = useState(null)

  useEffect(function() { loadAll() }, [])
  useEffect(function() {
    if (liveTrainingActive && view !== 'edit-program') {
      setProgForm({ name: '', description: '' }); setSessions([]); setEditingProg(null); setView('edit-program')
      if (onEditingChange) onEditingChange(true)
    }
  }, [liveTrainingActive])

  async function loadAll() {
    setLoading(true)
    try {
      var exQ = supabase.from('exercises').select('*').order('muscle_group').order('name').limit(5000)
      if (coachId) exQ = exQ.or('coach_id.eq.' + coachId + ',coach_id.is.null')
      var exR = await exQ
      var progQ = supabase.from('programs').select('*').order('created_at',{ascending:false})
      if (coachId) progQ = progQ.eq('coach_id', coachId)
      var progR = await progQ
      var clQ = supabase.from('profiles').select('id,full_name,email,beta_features').eq('is_admin',false)
      if (coachId) clQ = clQ.eq('coach_id', coachId)
      var clR = await clQ.order('full_name')
      var sessR = await supabase.from('program_sessions').select('*').order('order_index')
      var peR = await supabase.from('program_exercises').select('*').order('order_index')
      var exList = exR.data || []
      var progList = progR.data || []
      var sessList = sessR.data || []
      var peList = peR.data || []
      var exMap = {}
      exList.forEach(function(e) { exMap[e.id] = e })
      progList.forEach(function(pr) {
        pr.program_sessions = sessList.filter(function(s) { return s.program_id === pr.id })
        pr.program_sessions.forEach(function(s) {
          s.program_exercises = peList.filter(function(pe) { return pe.session_id === s.id }).map(function(pe) { pe.exercises = exMap[pe.exercise_id] || null; return pe })
        })
      })
      setExercises(exList)
      setPrograms(progList)
      setClients(clR.data || [])
    } catch(e) { console.log('loadAll err:', e) }
    setLoading(false)
    loadVideos()
    loadBlocks()
    if(coachMode&&coachClientId)loadClientProgs()
  }

  async function loadClientProgs(){
    var r=await supabase.from('client_programs').select('program_id').eq('client_id',coachClientId)
    setClientAssignedProgs((r.data||[]).map(function(cp){return cp.program_id}))
  }

  async function uploadGif(file) {
    if (!file || file.size > 10*1024*1024) return
    setUploading(true)
    var path = 'exercises/' + Date.now() + '.' + file.name.split('.').pop()
    await supabase.storage.from('avatars').upload(path, file, {upsert:true})
    var u = supabase.storage.from('avatars').getPublicUrl(path)
    setExForm(function(f) { return Object.assign({}, f, {gif_url: u.data.publicUrl}) })
    setUploading(false)
  }

  async function saveExercise() {
    if (!exForm.name.trim()) return
    var desc = techSteps.filter(function(s){return s.trim()}).map(function(s,i){return (i+1)+'. '+s.trim()}).join('\n')
    var data = {name:exForm.name,muscle_group:exForm.muscle_group,secondary_muscle:exForm.secondary_muscle||null,equipment:exForm.equipment,description:desc,gif_url:exForm.gif_url,video_url:exForm.video_url,alias:exForm.alias||null,tips:exForm.tips||null,allow_bodyweight:exForm.allow_bodyweight||false,custom_sections:(exForm.custom_sections||[]).length>0?JSON.stringify(exForm.custom_sections):null,coach_id:isSuperAdmin?null:(coachId||null)}
    if (editingEx) await supabase.from('exercises').update(data).eq('id',editingEx)
    else await supabase.from('exercises').insert(data)
    setExForm({name:'',muscle_group:'',secondary_muscle:'',equipment:'',description:'',tips:'',custom_sections:[],gif_url:'',video_url:'',allow_bodyweight:false})
    setTechSteps(['']); setEditingEx(null); setView('exercises'); loadAll()
  }

  function tryLeaveProgram(destination) {
    if (view === 'edit-program' && (sessions.length > 0 || progForm.name)) {
      setLeaveConfirm(destination)
    } else if (destination === 'back') {
      if(onEditingChange) onEditingChange(false); onBack()
    } else {
      if(onEditingChange) onEditingChange(false); setView(destination); setEditingProg(null)
    }
  }

  async function saveProgram() {
    if (!progForm.name.trim()) return
    var progId
    if (editingProg) {
      await supabase.from('programs').update({name:progForm.name,description:progForm.description}).eq('id',editingProg)
      progId = editingProg
      var old = programs.find(function(p){return p.id===editingProg})
      if (old) { for(var oi=0;oi<(old.program_sessions||[]).length;oi++){await supabase.from('program_exercises').delete().eq('session_id',old.program_sessions[oi].id)} }
      await supabase.from('program_sessions').delete().eq('program_id',editingProg)
    } else {
      var r = await supabase.from('programs').insert({name:progForm.name,description:progForm.description,is_template:true,coach_id:coachId||null}).select().single()
      progId = r.data.id
    }
    for(var si=0;si<sessions.length;si++){
      var sess=sessions[si]
      var sr=await supabase.from('program_sessions').insert({program_id:progId,name:sess.name,order_index:si,workout_mode:sess.mode||'normal',mode_settings:JSON.stringify({rounds:sess.rounds||1,tabata_work:sess.tabata_work||20,tabata_rest:sess.tabata_rest||10,tabata_rounds:sess.tabata_rounds||8,duration:sess.duration||600,emom_minutes:sess.emom_minutes||10})}).select().single()
      if(sr.data){
        // Compute block mode for each exercise from separators
        var currentBlockMode = sess.mode || 'normal'
        var currentBlockSettings = {}
        var currentBlockName = ''
        var exItems = []
        sess.items.forEach(function(item) {
          if (item.type === 'separator') {
            currentBlockMode = item.mode || 'normal'
            currentBlockSettings = item.block_settings || {}
            currentBlockName = item.name || ''
          } else if (item.type === 'exercise') {
            exItems.push(Object.assign({}, item, { _blockMode: currentBlockMode, _blockSettings: currentBlockSettings, _blockName: currentBlockName }))
          }
        })
        if(exItems.length>0){
          var insertPayload = exItems.map(function(pe,ei){var isCircuit=pe._blockMode&&pe._blockMode!=='normal';return{session_id:sr.data.id,exercise_id:pe.exercise_id,sets:pe.sets_detail?pe.sets_detail.length:(pe.sets||3),rep_min:pe.rep_min||8,rep_max:pe.rep_max||12,rep_mode:isCircuit?'duration':(pe.rep_mode||'range'),rest_seconds:isCircuit?(pe.rest_seconds!=null?pe.rest_seconds:10):(pe.rest_seconds||90),order_index:ei,notes:pe.notes||'',superset_group:pe.superset_group||null,sets_config:pe.sets_detail?JSON.stringify(pe.sets_detail):null,alternative_ids:pe.alternative_ids||null,block_mode:pe._blockMode||'normal',block_settings:pe._blockSettings?JSON.stringify(pe._blockSettings):null,block_name:pe._blockName||null}})
          await supabase.from('program_exercises').insert(insertPayload)
        }
      }
    }
    setProgForm({name:'',description:''}); setSessions([]); setEditingProg(null); setView('programs'); if(onEditingChange) onEditingChange(false); loadAll()
  }

  function editProgram(prog) {
    setProgForm({name:prog.name,description:prog.description||''})
    setSessions((prog.program_sessions||[]).map(function(s){
      var ms={};try{ms=s.mode_settings?JSON.parse(s.mode_settings):{}}catch(e){}
      return{name:s.name,mode:s.workout_mode||'normal',rounds:ms.rounds||1,tabata_work:ms.tabata_work||20,tabata_rest:ms.tabata_rest||10,tabata_rounds:ms.tabata_rounds||8,duration:ms.duration||600,emom_minutes:ms.emom_minutes||10,items:(function(){
        var items = []
        var lastBlockName = ''
        var lastBlockMode = s.workout_mode || 'normal'
        ;(s.program_exercises||[]).forEach(function(pe){
          var sd=null;try{sd=pe.sets_config?JSON.parse(pe.sets_config):null}catch(e){}
          if(!sd){sd=[];for(var k=0;k<(pe.sets||3);k++)sd.push({t:'work',w:'',r:''})}
          var bm = pe.block_mode || 'normal'
          var bn = pe.block_name || ''
          var bs = {}; try { bs = pe.block_settings ? JSON.parse(pe.block_settings) : {} } catch(e) {}
          // Insert separator when block changes
          if (bn !== lastBlockName || bm !== lastBlockMode) {
            if (bn || bm !== 'normal' || lastBlockName !== null) {
              items.push({type:'separator',name:bn||'Bloc',mode:bm,block_settings:bs})
            }
            lastBlockName = bn
            lastBlockMode = bm
          }
          items.push({type:'exercise',exercise_id:pe.exercise_id,exercise:pe.exercises,sets:pe.sets,sets_detail:sd,rep_min:pe.rep_min,rep_max:pe.rep_max,rep_mode:pe.rep_mode||'range',rest_seconds:pe.rest_seconds,notes:pe.notes||'',superset_group:pe.superset_group||null,alternative_ids:pe.alternative_ids||null})
        })
        return items
      })()}
    }))
    setActiveSession(0); setEditingProg(prog.id); setView('edit-program'); if(onEditingChange) onEditingChange(true)
  }

  async function deleteProgram(id){if(!confirm('Supprimer ?'))return;await supabase.from('program_sessions').delete().eq('program_id',id);await supabase.from('client_programs').delete().eq('program_id',id);await supabase.from('programs').delete().eq('id',id);loadAll()}
  async function assignProgram(){
    if(!assignProg||!assignClient)return
    var prog=programs.find(function(p){return p.id===assignProg})
    if(!prog)return
    var clientName=(clients.find(function(c){return c.id===assignClient})||{}).full_name||'Client'
    // Create a copy for this client
    var {data:newProg}=await supabase.from('programs').insert({name:prog.name+' — '+clientName,description:prog.description,is_template:false,coach_id:coachId||null}).select().single()
    if(!newProg)return
    for(var si=0;si<(prog.program_sessions||[]).length;si++){
      var sess=prog.program_sessions[si]
      var {data:newSess}=await supabase.from('program_sessions').insert({program_id:newProg.id,name:sess.name,order_index:si,workout_mode:sess.workout_mode,mode_settings:sess.mode_settings}).select().single()
      if(newSess&&sess.program_exercises){
        await supabase.from('program_exercises').insert(sess.program_exercises.map(function(pe,ei){return{session_id:newSess.id,exercise_id:pe.exercise_id,sets:pe.sets,rep_min:pe.rep_min,rep_max:pe.rep_max,rep_mode:pe.rep_mode,rest_seconds:pe.rest_seconds,order_index:ei,notes:pe.notes,superset_group:pe.superset_group,sets_config:pe.sets_config,alternative_ids:pe.alternative_ids,block_mode:pe.block_mode||'normal',block_settings:pe.block_settings||null,block_name:pe.block_name||null}}))
      }
    }
    await supabase.from('client_programs').insert({client_id:assignClient,program_id:newProg.id})
    await supabase.from('profiles').update({beta_features:true}).eq('id',assignClient)
    setMsg({type:'success',text:'Programme copié et assigné à '+clientName+' !'})
    setAssignProg(null);setAssignClient('');loadAll()
  }

  function addSession(){setSessions(function(s){return s.concat([{name:'Séance '+'ABCDEFGHIJ'[s.length],items:[]}])})}
  function removeSession(i){setSessions(function(s){return s.filter(function(_,j){return j!==i})});setActiveSession(0)}
  function addExToSession(ex){setSessions(function(s){return s.map(function(sess,i){if(i!==activeSession)return sess;var newEx={type:'exercise',exercise_id:ex.id,exercise:ex,sets:3,sets_detail:[{t:'work',w:'',r:''},{t:'work',w:'',r:''},{t:'work',w:'',r:''}],rep_min:8,rep_max:12,rep_mode:'range',rest_seconds:90,notes:'',superset_group:null};
    // Determine block mode at insertion point
    var blockMode=sess.mode||'normal';
    var items=sess.items;
    if(insertAtIdx!==null){
      var checkTo=insertAtIdx===-1?0:Math.min(insertAtIdx,items.length);
      for(var bi=0;bi<checkTo;bi++){if(items[bi]&&items[bi].type==='separator')blockMode=items[bi].mode||'normal'}
    }
    if(blockMode==='circuit'){newEx.rep_min=30;newEx.rep_max=30;newEx.rep_mode='duration';newEx.rest_seconds=10}
    else if(blockMode==='tabata'){newEx.rep_min=0;newEx.rep_max=0;newEx.rep_mode='fixed';newEx.rest_seconds=0}
    else if(blockMode==='amrap'||blockMode==='fortime'){newEx.rep_min=10;newEx.rep_max=10;newEx.rep_mode='fixed';newEx.rest_seconds=0}
    else if(blockMode==='emom'){newEx.rep_min=10;newEx.rep_max=10;newEx.rep_mode='fixed';newEx.rest_seconds=0}
    if(insertAtIdx!==null){var itms=items.slice();var pos=insertAtIdx===-1?0:insertAtIdx+1;itms.splice(pos,0,newEx);return Object.assign({},sess,{items:itms})}
    return Object.assign({},sess,{items:items.concat([newEx])})})});
    if(insertAtIdx!==null)setInsertAtIdx(function(idx){return idx!==null?idx+1:null})
  }
  function addSeparator(){
    setSessions(function(s){return s.map(function(sess,i){if(i!==activeSession)return sess;
      var newSep = {type:'separator',name:'Nouveau bloc',mode:'normal',block_settings:{}}
      return Object.assign({},sess,{items:sess.items.concat([newSep])})
    })})
  }

  function updateItem(si,ii,f,v){setSessions(function(s){return s.map(function(sess,i){if(i!==si)return sess;return Object.assign({},sess,{items:sess.items.map(function(it,j){if(j!==ii)return it;var u=Object.assign({},it);u[f]=v;return u})})})})}

  function openAlternatives(ii, ex) {
    if (!ex) return
    var muscle = ex.muscle_group
    supabase.from('exercises').select('*').eq('muscle_group', muscle).order('name').then(function(r) {
      setAltList((r.data || []).filter(function(e) { return e.id !== ex.id }))
      setAltEditIdx(ii)
    })
  }
  function removeItem(si,ii){setSessions(function(s){return s.map(function(sess,i){if(i!==si)return sess;return Object.assign({},sess,{items:sess.items.filter(function(_,j){return j!==ii})})})})}
  function moveItem(si,ii,dir){setSessions(function(s){return s.map(function(sess,i){if(i!==si)return sess;var arr=sess.items.slice();var ni=ii+dir;if(ni<0||ni>=arr.length)return sess;var t=arr[ii];arr[ii]=arr[ni];arr[ni]=t;return Object.assign({},sess,{items:arr})})})}

  async function loadHistory(cid){var r=await supabase.from('workout_logs').select('*').eq('client_id',cid).order('completed_at',{ascending:false}).limit(50);setWorkoutHistory(r.data||[])}
  async function loadWorkoutDetail(lid){var r=await supabase.from('workout_sets').select('*').eq('workout_log_id',lid).order('set_number');setWorkoutDetail(r.data||[])}

  async function loadVideos(){
    var vfQ=supabase.from('video_folders').select('*').order('order_index')
    if(coachId)vfQ=vfQ.eq('coach_id',coachId)
    var r=await vfQ
    var folders=r.data||[]
    var vrQ=supabase.from('videos').select('*').order('order_index')
    if(coachId)vrQ=vrQ.eq('coach_id',coachId)
    var vr=await vrQ
    var allVideos=vr.data||[]
    folders.forEach(function(f){f.videos=allVideos.filter(function(v){return v.folder_id===f.id})})
    setVideoFolders(folders)
  }

  function getYoutubeId(url){
    if(!url)return null
    var m=url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    return m?m[1]:null
  }

  async function createFolder(){var n=prompt('Nom du dossier (ex: Abdos, Stretching...)');if(!n)return;var max=videoFolders.length;await supabase.from('video_folders').insert({name:n,order_index:max,coach_id:coachId||null});loadVideos()}
  async function deleteFolder(id){if(!confirm('Supprimer ce dossier et ses vidéos ?'))return;await supabase.from('videos').delete().eq('folder_id',id);await supabase.from('video_folders').delete().eq('id',id);setActiveFolder(null);loadVideos()}
  async function addVideo(folderId){if(!videoForm.title.trim()||!videoForm.youtube_url.trim())return;var max=(videoFolders.find(function(f){return f.id===folderId})||{}).videos;await supabase.from('videos').insert({folder_id:folderId,title:videoForm.title,youtube_url:videoForm.youtube_url,order_index:max?max.length:0,coach_id:coachId||null});setVideoForm({title:'',youtube_url:''});loadVideos()}
  async function deleteVideo(id){await supabase.from('videos').delete().eq('id',id);loadVideos()}

  async function loadBlocks(){
    var r=await supabase.from('saved_blocks').select('*').order('name')
    var br=await supabase.from('saved_block_exercises').select('*').order('order_index')
    var blocks=r.data||[];var allBE=br.data||[]
    blocks.forEach(function(b){b.exercises=allBE.filter(function(be){return be.block_id===b.id})})
    setSavedBlocks(blocks)
  }

  async function saveCurrentAsBlock(){
    if(!saveBlockName.trim()||!sessions[activeSession])return
    var items=sessions[activeSession].items.filter(function(x){return x.type==='exercise'})
    if(items.length===0)return
    var {data:block}=await supabase.from('saved_blocks').insert({name:saveBlockName}).select().single()
    if(block){
      await supabase.from('saved_block_exercises').insert(items.map(function(it,i){return{block_id:block.id,exercise_id:it.exercise_id,sets:it.sets,rep_min:it.rep_min,rep_max:it.rep_max,rep_mode:it.rep_mode||'range',rest_seconds:it.rest_seconds,order_index:i,notes:it.notes||'',superset_group:it.superset_group||null,sets_config:it.sets_detail?JSON.stringify(it.sets_detail):null}}))
    }
    setSaveBlockName('');setShowSaveBlock(false);loadBlocks()
    setMsg({type:'success',text:'Bloc "'+saveBlockName+'" sauvegardé !'})
  }

  async function insertBlock(block){
    var exIds=(block.exercises||[]).map(function(be){return be.exercise_id})
    var {data:exList}=await supabase.from('exercises').select('*').in('id',exIds)
    var exMap={};(exList||[]).forEach(function(e){exMap[e.id]=e})
    var newItems=(block.exercises||[]).map(function(be){
      var sd=null;try{sd=be.sets_config?JSON.parse(be.sets_config):null}catch(e){}
      if(!sd){sd=[];for(var k=0;k<(be.sets||3);k++)sd.push({t:'work',w:'',r:''})}
      return{type:'exercise',exercise_id:be.exercise_id,exercise:exMap[be.exercise_id]||null,sets:be.sets||3,sets_detail:sd,rep_min:be.rep_min||8,rep_max:be.rep_max||12,rep_mode:be.rep_mode||'range',rest_seconds:be.rest_seconds||90,notes:be.notes||'',superset_group:be.superset_group||null}
    })
    setSessions(function(s){return s.map(function(sess,i){if(i!==activeSession)return sess;return Object.assign({},sess,{items:sess.items.concat(newItems)})})})
    setShowInsertBlock(false)
    setMsg({type:'success',text:'Bloc "'+block.name+'" inséré !'})
  }

  async function deleteBlock(id){if(!confirm('Supprimer ce bloc ?'))return;await supabase.from('saved_block_exercises').delete().eq('block_id',id);await supabase.from('saved_blocks').delete().eq('id',id);loadBlocks()}

  if (playerSession) {
    return <WorkoutPlayer program={{id:playerSession.pid,name:playerSession.name,program_exercises:playerSession.exercises,blocks:playerSession.blocks||[]}} profileId={playerClientId||coachClientId} onClose={function(){setPlayerSession(null);loadAll()}} />
  }
  if (loading) return <div style={{textAlign:'center',padding:60,color:'var(--muted)'}}>Chargement...</div>

  var allEquip = EQUIPMENT.slice()
  exercises.forEach(function(e) { if (e.equipment && allEquip.indexOf(e.equipment) === -1) allEquip.push(e.equipment) })
  if (exForm.equipment && allEquip.indexOf(exForm.equipment) === -1) allEquip.push(exForm.equipment)
  var allMuscles = DEFAULT_MUSCLES.slice()
  exercises.forEach(function(e) { if (e.muscle_group) { e.muscle_group.split(',').forEach(function(m) { m = m.trim(); if (m && allMuscles.indexOf(m) === -1) allMuscles.push(m) }) } })
  if (exForm.muscle_group) { exForm.muscle_group.split(',').forEach(function(m) { m = m.trim(); if (m && allMuscles.indexOf(m) === -1) allMuscles.push(m) }) }
  allMuscles.sort()
  var filteredEx = exercises.filter(function(e){return(!exFilter||(e.muscle_group||'').split(',').map(function(m){return m.trim()}).indexOf(exFilter)>=0)&&(!exEquipFilter||e.equipment===exEquipFilter)&&(!exSearch||norm(e.name).includes(norm(exSearch)))})

  return (
    <div style={{maxWidth:900,margin:'0 auto',padding:'32px 16px'}}>
      {msg&&<div style={{background:msg.type==='success'?'rgba(74,222,128,0.08)':'rgba(248,113,113,0.08)',borderRadius:8,padding:'10px 14px',fontSize:12,color:msg.type==='success'?'#4ade80':'#f87171',marginBottom:12}}>{msg.text}</div>}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <button onClick={function(){if(view==='edit-program'){tryLeaveProgram('back')}else{onBack()}}} style={S.bk}>🏠 Accueil</button>
        <div style={{fontFamily:'Cormorant Garamond,serif',fontSize:22}}>{coachMode?coachClientName:'Programmes'}</div>
        <div style={{width:60}}/>
      </div>

      {view==='coach-select'&&<div>
        <div style={{display:'flex',gap:10,marginBottom:20}}>
          <button onClick={function(){setView('coach-select')}} style={{...S.bt,flex:1}}>🏋️ Séances</button>
          <button onClick={function(){loadHistory(coachClientId);setView('history')}} style={{...S.bt,flex:1,background:'var(--surface)',color:'var(--text)',border:'1px solid var(--border)'}}>📊 Historique</button>
          <button onClick={function(){setView('client-progression')}} style={{...S.bt,flex:1,background:'var(--surface)',color:'var(--text)',border:'1px solid var(--border)'}}>📈 Progression</button>
        </div>
        {(coachMode?programs.filter(function(p){return clientAssignedProgs.indexOf(p.id)!==-1}):programs).map(function(prog){return <div key={prog.id} style={{marginBottom:16,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div>
              <div style={{fontSize:15,fontWeight:500}}>{prog.name}</div>
              <div style={{fontSize:11,color:'var(--muted)'}}>{prog.is_template===false?'Programme personnalisé':'Programme modèle'}</div>
            </div>
            <div style={{display:'flex',gap:4}}>
              {prog.is_template===false ? (
                <button onClick={function(){editProgram(prog)}} style={{...S.bt,fontSize:10,padding:'6px 10px'}}>✏️ Modifier</button>
              ) : (
                <button onClick={async function(){
                  if(!confirm('Créer une copie personnalisée de "'+prog.name+'" pour '+coachClientName+' ?\n\nLe programme original ne sera pas modifié.'))return
                  var nr=await supabase.from('programs').insert({name:prog.name+' — '+coachClientName,description:prog.description,is_template:false}).select().single()
                  if(nr.data){
                    for(var si2=0;si2<(prog.program_sessions||[]).length;si2++){
                      var sess2=prog.program_sessions[si2]
                      var ns=await supabase.from('program_sessions').insert({program_id:nr.data.id,name:sess2.name,order_index:si2,workout_mode:sess2.workout_mode,mode_settings:sess2.mode_settings}).select().single()
                      if(ns.data&&sess2.program_exercises){
                        await supabase.from('program_exercises').insert(sess2.program_exercises.map(function(pe,ei){return{session_id:ns.data.id,exercise_id:pe.exercise_id,sets:pe.sets,rep_min:pe.rep_min,rep_max:pe.rep_max,rep_mode:pe.rep_mode,rest_seconds:pe.rest_seconds,order_index:ei,notes:pe.notes,superset_group:pe.superset_group,sets_config:pe.sets_config}}))
                      }
                    }
                    await supabase.from('client_programs').delete().eq('client_id',coachClientId).eq('program_id',prog.id)
                    await supabase.from('client_programs').insert({client_id:coachClientId,program_id:nr.data.id})
                    setMsg({type:'success',text:'Copie créée ! Tu peux maintenant la modifier.'})
                    loadAll();loadClientProgs()
                  }
                }} style={{...S.bt,fontSize:10,padding:'6px 10px'}}>✏️ Personnaliser</button>
              )}
              <button onClick={async function(){
                if(!confirm('Retirer "'+prog.name+'" de '+coachClientName+' ?'))return
                await supabase.from('client_programs').delete().eq('client_id',coachClientId).eq('program_id',prog.id)
                setMsg({type:'success',text:'Programme retiré.'})
                loadAll();loadClientProgs()
              }} style={{...S.sm,color:'#f87171',fontSize:10}}>🗑️</button>
            </div>
          </div>
          {/* Sessions with Lancer button */}
          <div style={{display:'grid',gridTemplateColumns:'1fr',gap:6}}>
            {(prog.program_sessions||[]).map(function(sess){
              var exCount=(sess.program_exercises||[]).length
              return <div key={sess.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:'var(--bg)',borderRadius:10,border:'1px solid var(--border)'}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:500}}>{sess.name}</div>
                  <div style={{fontSize:11,color:'var(--muted)'}}>{exCount} exercice{exCount>1?'s':''}</div>
                </div>
                <button onClick={function(){
                  // Build blocks from exercises
                  var blocks = []
                  var currentBlock = { mode: 'normal', settings: {}, startIdx: 0, name: '' }
                  sess.program_exercises.forEach(function(pe, idx) {
                    var peMode = pe.block_mode || 'normal'
                    var peName = pe.block_name || ''
                    var peSettings = {}; try { peSettings = pe.block_settings ? JSON.parse(pe.block_settings) : {} } catch(e) {}
                    if (idx === 0 || peMode !== currentBlock.mode || peName !== currentBlock.name) {
                      if (idx > 0) { currentBlock.endIdx = idx - 1; blocks.push(currentBlock) }
                      currentBlock = { mode: peMode, settings: peSettings, startIdx: idx, name: peName }
                    }
                  })
                  if (sess.program_exercises.length > 0) { currentBlock.endIdx = sess.program_exercises.length - 1; blocks.push(currentBlock) }
                  setPlayerSession({pid:prog.id,name:prog.name+' — '+sess.name,exercises:sess.program_exercises,blocks:blocks})
                  setPlayerClientId(coachClientId)
                }} style={{background:GOLD,color:'#000',border:'none',borderRadius:8,padding:'8px 14px',fontSize:11,fontWeight:600,cursor:'pointer',fontFamily:'Outfit'}}>▶ Lancer</button>
              </div>
            })}
          </div>
        </div>})}
      </div>}

      {view==='client-progression'&&<div>
        <div style={{fontSize:15,fontWeight:500,marginBottom:16}}>📈 Progression — {coachClientName}</div>
        <ProgressionChart clientId={coachClientId} exercises={exercises} />
        <button onClick={function(){setView('home')}} style={{...S.bk,marginTop:16}}>← Sport</button>
      </div>}

      {view==='history'&&<div>
        <div style={{fontSize:15,fontWeight:500,marginBottom:16}}>📊 Historique</div>
        {workoutHistory.map(function(log){var d=new Date(log.completed_at);return <button key={log.id} onClick={function(){setSelectedWorkout(log);loadWorkoutDetail(log.id);setView('workout-detail')}} style={{...S.rw,width:'100%',cursor:'pointer',textAlign:'left'}}><div style={{flex:1}}><div style={{fontSize:14,fontWeight:500}}>{d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})}</div><div style={{fontSize:11,color:'var(--muted)'}}>{log.duration_minutes||0} min</div>{log.comment&&<div style={{fontSize:11,color:'#7a7065',fontStyle:'italic'}}>"{log.comment}"</div>}</div>{log.emoji&&<div style={{fontSize:24}}>{log.emoji}</div>}<div style={{color:'var(--muted)'}}>›</div></button>})}
        {workoutHistory.length===0&&<div style={{textAlign:'center',padding:30,color:'var(--muted)'}}>Aucune séance</div>}
        <button onClick={function(){setView('coach-select')}} style={{...S.bk,marginTop:12}}>← Client</button>
      </div>}

      {view==='workout-detail'&&selectedWorkout&&<div>
        <button onClick={function(){setView('history')}} style={S.bk}>← Historique</button>
        <div style={{fontSize:14,fontWeight:500,marginTop:12,marginBottom:16}}>{new Date(selectedWorkout.completed_at).toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})} · {selectedWorkout.duration_minutes||0}min {selectedWorkout.emoji||''}</div>
        {selectedWorkout.comment&&<div style={{background:'rgba(196,151,58,0.06)',borderRadius:8,padding:'10px 14px',fontSize:12,color:GOLD,marginBottom:16}}>💬 {selectedWorkout.comment}</div>}
        {workoutDetail.map(function(s){return <div key={s.id} style={{...S.rw,fontSize:13}}>Série {s.set_number} · {s.weight_kg||0}kg × {s.reps}</div>})}
      </div>}

      {view==='home'&&<div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:12}}>
          <button onClick={function(){setView('exercises')}} style={S.tl}><div style={{fontSize:28}}>📚</div><div style={{fontSize:13,fontWeight:500}}>Librairie</div><div style={{fontSize:11,color:'var(--muted)'}}>{exercises.length} exercices</div></button>
          <button onClick={function(){setView('programs')}} style={S.tl}><div style={{fontSize:28}}>📋</div><div style={{fontSize:13,fontWeight:500}}>Programmes</div><div style={{fontSize:11,color:'var(--muted)'}}>{programs.length} prog</div></button>
          <button onClick={function(){setView('sport-clients')}} style={S.tl}><div style={{fontSize:28}}>👤</div><div style={{fontSize:13,fontWeight:500}}>Clients</div><div style={{fontSize:11,color:'var(--muted)'}}>Suivi sport</div></button>
        </div>
        <button onClick={function(){setView('videos')}} style={{...S.tl,width:'100%',display:'flex',alignItems:'center',gap:12,justifyContent:'center'}}><div style={{fontSize:22}}>🎬</div><div><div style={{fontSize:12,fontWeight:500}}>Vidéos</div><div style={{fontSize:10,color:'var(--muted)'}}>{videoFolders.length} dossier{videoFolders.length>1?'s':''}</div></div></button>
        {onLiveTraining && <button onClick={onLiveTraining} style={{...S.tl,width:'100%',display:'flex',alignItems:'center',gap:12,justifyContent:'center',borderColor:'rgba(74,222,128,0.3)'}}><div style={{fontSize:22}}>🎯</div><div><div style={{fontSize:12,fontWeight:500}}>Live Training</div><div style={{fontSize:10,color:'var(--muted)'}}>Séance en direct avec un client</div></div></button>}
      </div>}

      {view==='exercises'&&<div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontSize:15,fontWeight:500}}>Exercices ({filteredEx.length})</div>
          <div style={{display:'flex',gap:6}}>
            {Object.keys(selectedExIds).filter(function(k){return selectedExIds[k]}).length>0&&<button onClick={async function(){var ids=Object.keys(selectedExIds).filter(function(k){return selectedExIds[k]});if(!confirm('Supprimer '+ids.length+' exercice(s) ?'))return;for(var i=0;i<ids.length;i++){await supabase.from('exercises').delete().eq('id',ids[i])}setSelectedExIds({});loadAll()}} style={{background:'#dc2626',color:'#fff',border:'none',borderRadius:6,padding:'6px 12px',fontSize:11,cursor:'pointer',fontFamily:'Outfit'}}>🗑️ {Object.keys(selectedExIds).filter(function(k){return selectedExIds[k]}).length}</button>}
            <button onClick={function(){setExForm({name:'',muscle_group:'',secondary_muscle:'',equipment:'',description:'',gif_url:'',video_url:'',allow_bodyweight:false});setEditingEx(null);setView('add-exercise')}} style={S.bt}>+ Ajouter</button>
          </div>
        </div>
        <div style={{display:'flex',gap:6,marginBottom:8,flexWrap:'wrap'}}>
          <input placeholder="🔍 Rechercher" value={exSearch} onChange={function(e){setExSearch(e.target.value)}} style={{...S.ip,flex:1,minWidth:120,padding:'7px 10px',fontSize:12}}/>
          <select value={exFilter} onChange={function(e){setExFilter(e.target.value)}} style={{...S.ip,width:120,fontSize:11,padding:'7px'}}><option value="">Muscle</option>{allMuscles.map(function(g){return <option key={g}>{g}</option>})}</select>
          <select value={exEquipFilter} onChange={function(e){setExEquipFilter(e.target.value)}} style={{...S.ip,width:120,fontSize:11,padding:'7px'}}><option value="">Équipement</option>{allEquip.map(function(g){return <option key={g}>{g}</option>})}</select>
        </div>
        <label style={{display:'flex',alignItems:'center',gap:6,fontSize:11,color:'var(--muted)',cursor:'pointer',marginBottom:10}}><input type="checkbox" checked={filteredEx.length>0&&filteredEx.every(function(e){return selectedExIds[e.id]})} onChange={function(){var all=filteredEx.every(function(e){return selectedExIds[e.id]});var n=Object.assign({},selectedExIds);filteredEx.forEach(function(e){n[e.id]=!all});setSelectedExIds(n)}} style={{accentColor:'#C4973A'}}/> Tout sélectionner</label>
        {filteredEx.map(function(ex){return <SwipeRow key={ex.id} actions={[{icon:'✏️',label:'Modifier',color:'#2563eb',onClick:function(){
          var steps=[''];if(ex.description){steps=ex.description.split('\n').map(function(l){return l.replace(/^\d+\.\s*/,'')})}if(steps.length===0)steps=['']
          var cs=[];try{cs=ex.custom_sections?JSON.parse(ex.custom_sections):[]}catch(e){}
          setExForm(Object.assign({},ex,{tips:ex.tips||'',custom_sections:cs}));setTechSteps(steps);setEditingEx(ex.id);setView('add-exercise')
        }},{icon:'🗑️',label:'Supprimer',color:'#dc2626',onClick:function(){if(confirm('Supprimer '+ex.name+' ?'))supabase.from('exercises').delete().eq('id',ex.id).then(loadAll)}}]} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',border:'1px solid var(--border)',borderRadius:10,cursor:'pointer'}}>
          <input type="checkbox" checked={selectedExIds[ex.id]||false} onChange={function(e){e.stopPropagation();setSelectedExIds(function(s){var n=Object.assign({},s);n[ex.id]=!n[ex.id];return n})}} onClick={function(e){e.stopPropagation()}} style={{accentColor:'#C4973A',flexShrink:0}} />
          {ex.gif_url&&<FrozenImg src={ex.gif_url} style={{width:40,height:40,borderRadius:6,objectFit:'cover',background:'var(--surface2)',cursor:'pointer'}} />}
          <div onClick={function(){setDetailEx(ex)}} style={{flex:1,cursor:'pointer'}}><div style={{fontSize:13,fontWeight:500}}>{ex.name}{ex.alias?' · '+ex.alias:''}</div><div style={{fontSize:10,color:GOLD}}>{ex.muscle_group}{ex.equipment?' · '+ex.equipment:''}{ex.video_url?' · ▶ YouTube':''}</div></div>
          <button onClick={function(e){e.stopPropagation();if(confirm('Supprimer '+ex.name+' ?'))supabase.from('exercises').delete().eq('id',ex.id).then(loadAll)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,color:'#f87171',padding:'4px 8px',opacity:0.5}}>🗑️</button>
        </SwipeRow>})}
        <button onClick={function(){setView('home')}} style={{...S.bk,marginTop:12}}>← Sport</button>
      </div>}

      {view==='add-exercise'&&<div>
        <div style={{fontSize:15,fontWeight:500,marginBottom:12}}>{editingEx?'Modifier':'Ajouter'}</div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div><div style={S.lb}>Nom *</div><input value={exForm.name} onChange={function(e){setExForm(function(f){return Object.assign({},f,{name:e.target.value})})}} style={S.ip}/></div>
          <div><div style={S.lb}>Alias (nom alternatif)</div><input value={exForm.alias||''} onChange={function(e){setExForm(function(f){return Object.assign({},f,{alias:e.target.value})})}} placeholder="Ex: Développé couché = Bench press" style={{...S.ip,fontSize:12}}/></div>
          <div style={{display:'flex',gap:8}}><div style={{flex:1}}><div style={S.lb}>Muscles sollicités</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:6}}>
              {(exForm.muscle_group||'').split(',').filter(function(m){return m.trim()}).map(function(m){return <button key={m} onClick={function(){setExForm(function(f){var arr=f.muscle_group.split(',').filter(function(x){return x.trim()&&x.trim()!==m.trim()});return Object.assign({},f,{muscle_group:arr.join(',')})})}} style={{padding:'4px 10px',borderRadius:20,background:'rgba(196,151,58,0.15)',border:'1px solid rgba(196,151,58,0.3)',color:GOLD,fontSize:11,cursor:'pointer',fontFamily:'Outfit',display:'flex',alignItems:'center',gap:4}}>{m.trim()} <span style={{fontSize:9}}>✕</span></button>})}
            </div>
            <select value="" onChange={function(e){if(!e.target.value)return;if(e.target.value==='__new'){var n=prompt('Nom de la nouvelle catégorie');if(n){setExForm(function(f){var cur=(f.muscle_group||'').split(',').filter(function(x){return x.trim()});if(cur.indexOf(n)===-1)cur.push(n);return Object.assign({},f,{muscle_group:cur.join(',')})})}}else{var v=e.target.value;setExForm(function(f){var cur=(f.muscle_group||'').split(',').filter(function(x){return x.trim()});if(cur.indexOf(v)===-1)cur.push(v);return Object.assign({},f,{muscle_group:cur.join(',')})})};e.target.value=''}} style={{...S.ip,fontSize:12}}><option value="">+ Ajouter un muscle...</option>{allMuscles.filter(function(m){return !(exForm.muscle_group||'').split(',').map(function(x){return x.trim()}).includes(m)}).map(function(g){return <option key={g}>{g}</option>})}<option value="__new">+ Créer...</option></select>
          </div><div style={{flex:1}}><div style={S.lb}>Équipement</div><select value={exForm.equipment} onChange={function(e){if(e.target.value==='__new'){var n=prompt('Nom du nouvel équipement');if(n)setExForm(function(f){return Object.assign({},f,{equipment:n})})}else{setExForm(function(f){return Object.assign({},f,{equipment:e.target.value})})}}} style={S.ip}><option value="">—</option>{allEquip.map(function(g){return <option key={g}>{g}</option>})}<option value="__new">+ Créer...</option></select></div></div>

          {/* Muscle secondaire + PDC */}
          <div style={{display:'flex',gap:12,marginBottom:12}}>
            <div style={{flex:1}}><div style={S.lb}>Muscle secondaire</div>
              <input value={exForm.secondary_muscle||''} onChange={function(e){setExForm(function(f){return Object.assign({},f,{secondary_muscle:e.target.value})})}} placeholder="Ex: Ischio-jambiers, Fessiers" style={{...S.ip,fontSize:12}} />
            </div>
            <div style={{display:'flex',alignItems:'flex-end',paddingBottom:4}}>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:12}}>
                <input type="checkbox" checked={exForm.allow_bodyweight||false} onChange={function(e){setExForm(function(f){return Object.assign({},f,{allow_bodyweight:e.target.checked})})}} style={{accentColor:GOLD,width:16,height:16}} />
                PDC
              </label>
            </div>
          </div>

          {/* Technique d'exécution - étapes numérotées */}
          <div>
            <div style={S.lb}>Technique d'exécution</div>
            {techSteps.map(function(step,i){
              return <div key={i} style={{display:'flex',gap:6,alignItems:'center',marginBottom:4}}>
                <div style={{fontSize:12,fontWeight:600,color:GOLD,width:20,textAlign:'center'}}>{i+1}.</div>
                <input value={step} onChange={function(e){var v=e.target.value;setTechSteps(function(s){return s.map(function(st,j){return j===i?v:st})})}} placeholder={'Étape '+(i+1)+'...'} style={{...S.ip,flex:1,padding:'7px 10px',fontSize:12}}/>
                {techSteps.length>1&&<button onClick={function(){setTechSteps(function(s){return s.filter(function(_,j){return j!==i})})}} style={{background:'none',border:'none',color:'#f87171',cursor:'pointer',fontSize:12}}>✕</button>}
              </div>
            })}
            <button onClick={function(){setTechSteps(function(s){return s.concat([''])})}} style={{...S.bk,border:'1px dashed var(--border)',borderRadius:5,padding:'4px 12px',fontSize:10,marginTop:4}}>+ Étape</button>
          </div>

          {/* Conseils d'entraînement */}
          <div>
            <div style={S.lb}>Conseils d'entraînement</div>
            <textarea value={exForm.tips||''} onChange={function(e){setExForm(function(f){return Object.assign({},f,{tips:e.target.value})})}} placeholder="Erreurs à éviter, astuces, variantes..." style={{...S.ip,minHeight:60,fontSize:12}}/>
          </div>

          {/* Sections facultatives */}
          {(exForm.custom_sections||[]).map(function(sec,i){
            return <div key={i} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:10}}>
              <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:6}}>
                <input value={sec.title} onChange={function(e){var v=e.target.value;setExForm(function(f){var cs=(f.custom_sections||[]).map(function(s,j){return j===i?Object.assign({},s,{title:v}):s});return Object.assign({},f,{custom_sections:cs})})}} placeholder="Titre de la section" style={{...S.ip,flex:1,padding:'6px 8px',fontSize:12,fontWeight:500}}/>
                <button onClick={function(){setExForm(function(f){return Object.assign({},f,{custom_sections:(f.custom_sections||[]).filter(function(_,j){return j!==i})})})}} style={{background:'none',border:'none',color:'#f87171',cursor:'pointer',fontSize:12}}>✕</button>
              </div>
              <textarea value={sec.content} onChange={function(e){var v=e.target.value;setExForm(function(f){var cs=(f.custom_sections||[]).map(function(s,j){return j===i?Object.assign({},s,{content:v}):s});return Object.assign({},f,{custom_sections:cs})})}} placeholder="Contenu..." style={{...S.ip,minHeight:50,fontSize:12}}/>
            </div>
          })}
          <button onClick={function(){setExForm(function(f){return Object.assign({},f,{custom_sections:(f.custom_sections||[]).concat([{title:'',content:''}])})})}} style={{...S.bk,border:'1px dashed var(--border)',borderRadius:6,padding:'6px 12px',fontSize:11}}>+ Section facultative</button>

          {/* GIF */}
          <div><div style={S.lb}>GIF / Image</div><div style={{display:'flex',gap:8,alignItems:'center'}}><label style={{...S.bt,cursor:'pointer'}}>{uploading?'...':'📷 Uploader'}<input type="file" accept="image/*,.gif" style={{display:'none'}} onChange={function(e){uploadGif(e.target.files[0])}}/></label><input value={exForm.gif_url} onChange={function(e){setExForm(function(f){return Object.assign({},f,{gif_url:e.target.value})})}} placeholder="ou URL" style={{...S.ip,flex:1,fontSize:12}}/></div>{exForm.gif_url&&<img src={exForm.gif_url} style={{width:80,borderRadius:8,marginTop:6}}/>}</div>

          {/* YouTube */}
          <div><div style={S.lb}>Vidéo YouTube (facultatif)</div><input value={exForm.video_url||''} onChange={function(e){setExForm(function(f){return Object.assign({},f,{video_url:e.target.value})})}} placeholder="https://youtube.com/watch?v=..." style={{...S.ip,fontSize:12}}/></div>

          <div style={{display:'flex',gap:10}}><button onClick={saveExercise} style={S.bt}>{editingEx?'Enregistrer':'Ajouter'}</button><button onClick={function(){setView('exercises');setEditingEx(null);setTechSteps([''])}} style={S.bk}>Annuler</button></div>
        </div>
      </div>}

      {view==='programs'&&<div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><div style={{fontSize:15,fontWeight:500}}>Programmes</div><button onClick={function(){setProgForm({name:'',description:''});setSessions([]);setEditingProg(null);setView('edit-program');if(onEditingChange)onEditingChange(true)}} style={S.bt}>+ Créer</button></div>
        {programs.filter(function(p){return p.is_template!==false}).map(function(prog){var sc=(prog.program_sessions||[]).length;return <SwipeRow key={prog.id} actions={[{icon:'✏️',label:'Modifier',color:'#2563eb',onClick:function(){editProgram(prog)}},{icon:'👤',label:'Assigner',color:'#059669',onClick:function(){setAssignProg(prog.id);setView('assign')}},{icon:'🗑️',label:'Supprimer',color:'#dc2626',onClick:function(){deleteProgram(prog.id)}}]} onLongPress={function(){setLongMenu({title:prog.name,options:[{icon:'✏️',label:'Modifier',onClick:function(){editProgram(prog)}},{icon:'👤',label:'Assigner à un client',onClick:function(){setAssignProg(prog.id);setView('assign')}},{icon:'🗑️',label:'Supprimer',danger:true,onClick:function(){deleteProgram(prog.id)}}]})}} style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',border:'1px solid var(--border)',borderRadius:10,cursor:'pointer'}}>
          <div onClick={function(){editProgram(prog)}} style={{flex:1,cursor:'pointer'}}>
          <div><div style={{fontSize:14,fontWeight:500}}>{prog.name}</div><div style={{fontSize:11,color:GOLD}}>{sc} séance{sc>1?'s':''}</div></div></div>
          <button onClick={function(e){e.stopPropagation();setAssignProg(prog.id);setView('assign')}} title="Assigner à un client" style={{background:'rgba(196,151,58,0.1)',border:'1px solid rgba(196,151,58,0.2)',borderRadius:8,cursor:'pointer',fontSize:14,padding:'6px 10px',color:GOLD}}>👤</button>
          <button onClick={function(e){e.stopPropagation();editProgram(prog)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:'4px'}}>✏️</button>
          <button onClick={function(e){e.stopPropagation();deleteProgram(prog.id)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:14,padding:'4px',opacity:0.5}}>🗑️</button>
        </SwipeRow>})}

        {/* Blocs button */}
        <button onClick={function(){setView('blocks')}} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'14px 16px',background:'var(--surface)',border:'1px dashed var(--border)',borderRadius:10,cursor:'pointer',fontFamily:'Outfit',color:'var(--text)',marginTop:12}}>
          <div style={{fontSize:20}}>📦</div>
          <div style={{flex:1,textAlign:'left'}}><div style={{fontSize:13,fontWeight:500}}>Blocs réutilisables</div><div style={{fontSize:11,color:'var(--muted)'}}>{savedBlocks.length} bloc{savedBlocks.length>1?'s':''}</div></div>
          <div style={{fontSize:16,color:'var(--muted)'}}>›</div>
        </button>

        <button onClick={function(){setView('home')}} style={{...S.bk,marginTop:12}}>← Sport</button>
      </div>}

      {view==='edit-program'&&<div>
        <div style={{display:'flex',gap:8,marginBottom:14}}><input value={progForm.name} onChange={function(e){setProgForm(function(f){return Object.assign({},f,{name:e.target.value})})}} placeholder="Nom" style={{...S.ip,flex:1,fontWeight:500}}/><input value={progForm.description} onChange={function(e){setProgForm(function(f){return Object.assign({},f,{description:e.target.value})})}} placeholder="Description" style={{...S.ip,flex:1,fontSize:12}}/></div>
        <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
          {sessions.map(function(sess,i){return <button key={i} onClick={function(){setActiveSession(i)}} style={{padding:'6px 14px',borderRadius:7,border:'1px solid',borderColor:i===activeSession?GOLD:'var(--border)',background:i===activeSession?'rgba(196,151,58,0.1)':'transparent',color:'var(--text)',cursor:'pointer',fontFamily:'Outfit',fontSize:12}}>{sess.name}</button>})}
          <button onClick={addSession} style={{padding:'6px 14px',borderRadius:7,border:'1px dashed var(--border)',background:'transparent',color:GOLD,cursor:'pointer',fontFamily:'Outfit',fontSize:12}}>+ Séance</button>
        </div>
        {sessions[activeSession]&&<div>
          <div style={{display:'flex',gap:6,marginBottom:8}}><input value={sessions[activeSession].name} onChange={function(e){var v=e.target.value;setSessions(function(s){return s.map(function(sess,i){if(i!==activeSession)return sess;return Object.assign({},sess,{name:v})})})}} style={{...S.ip,flex:1,fontSize:13,fontWeight:500,padding:'7px 10px'}}/><button onClick={function(){removeSession(activeSession)}} style={{...S.sm,color:'#f87171'}}>🗑️</button></div>
          {(function(){
            var sess=sessions[activeSession]; if(!sess) return null
            var totalSec=0; var curMode=sess.mode||'normal'
            sess.items.forEach(function(item){
              if(item.type==='separator'){curMode=item.mode||'normal';return}
              if(item.type!=='exercise')return
              if(curMode==='normal'){
                var sets=(item.sets_detail||[]).length||item.sets||3
                var restPer=item.rest_seconds||90
                totalSec+=sets*(30+restPer)
              } else if(curMode==='circuit'){
                totalSec+=(item.rep_min||30)+(item.rest_seconds||10)
              } else if(curMode==='tabata'){
                totalSec+=(sess.tabata_work||20)+(sess.tabata_rest||10)
              } else if(curMode==='amrap'||curMode==='fortime'){
                totalSec+=30
              } else if(curMode==='emom'){
                totalSec+=60
              }
            })
            if(curMode==='amrap')totalSec=sess.duration||600
            if(curMode==='emom')totalSec=(sess.emom_minutes||10)*60
            var min=Math.floor(totalSec/60); var sec=totalSec%60
            return <div style={{fontSize:10,color:'var(--muted)',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>⏱️ Durée estimée : <strong style={{color:GOLD}}>{min} min{sec>0?' '+sec+'s':''}</strong></div>
          })()}

          {/* Workout mode */}
          <div style={{background:'rgba(196,151,58,0.04)',border:'1px solid rgba(196,151,58,0.15)',borderRadius:10,padding:12,marginBottom:12}}>
            <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:8}}>
              <div style={{flex:1,height:1,background:GOLD,opacity:0.3}}/>
              <input value={sessions[activeSession].section_title||''} onChange={function(e){var v=e.target.value;setSessions(function(s){return s.map(function(sess,i){if(i!==activeSession)return sess;return Object.assign({},sess,{section_title:v})})})}} placeholder="Nom du bloc (ex: Échauffement)" style={{background:'transparent',border:'none',color:GOLD,fontSize:12,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.1em',textAlign:'center',outline:'none',fontFamily:'Outfit',width:220}} />
              <div style={{flex:1,height:1,background:GOLD,opacity:0.3}}/>
            </div>
            <div style={{display:'flex',gap:4,alignItems:'center',flexWrap:'wrap',marginBottom:6}}>
              {[{v:'normal',l:'🏋️ Séries'},{v:'circuit',l:'🔄 Circuit'},{v:'tabata',l:'⚡ Tabata'},{v:'amrap',l:'💀 AMRAP'},{v:'fortime',l:'⏱️ For Time'},{v:'emom',l:'⏰ EMOM'}].map(function(opt){
                var isActive = (sessions[activeSession].mode||'normal') === opt.v
                return <button key={opt.v} onClick={function(){var v=opt.v;setSessions(function(s){return s.map(function(sess,i){if(i!==activeSession)return sess;return Object.assign({},sess,{mode:v})})})}} style={{background:isActive?GOLD:'var(--surface2)',color:isActive?'#000':'var(--text)',border:isActive?'2px solid '+GOLD:'1px solid var(--border)',borderRadius:8,padding:'5px 10px',fontSize:11,fontWeight:isActive?600:400,cursor:'pointer',fontFamily:'Outfit',transition:'all 0.15s'}}>{opt.l}</button>
              })}
            </div>
            {sessions[activeSession].mode==='circuit'&&<div style={{display:'flex',gap:6}}><div><div style={{fontSize:8,color:'var(--muted)'}}>TOURS</div><input type="number" value={sessions[activeSession].rounds||1} onChange={function(e){var v=parseInt(e.target.value)||1;setSessions(function(s){return s.map(function(sess,i){if(i!==activeSession)return sess;return Object.assign({},sess,{rounds:v})})})}} style={{...S.ip,width:60,padding:'4px',fontSize:11,textAlign:'center'}}/></div></div>}
            {sessions[activeSession].mode==='tabata'&&<div style={{display:'flex',gap:6}}><div><div style={{fontSize:8,color:'var(--muted)'}}>TRAVAIL (s)</div><input type="number" value={sessions[activeSession].tabata_work||20} onChange={function(e){var v=parseInt(e.target.value)||20;setSessions(function(s){return s.map(function(sess,i){if(i!==activeSession)return sess;return Object.assign({},sess,{tabata_work:v})})})}} style={{...S.ip,width:60,padding:'4px',fontSize:11,textAlign:'center'}}/></div><div><div style={{fontSize:8,color:'var(--muted)'}}>REPOS (s)</div><input type="number" value={sessions[activeSession].tabata_rest||10} onChange={function(e){var v=parseInt(e.target.value)||10;setSessions(function(s){return s.map(function(sess,i){if(i!==activeSession)return sess;return Object.assign({},sess,{tabata_rest:v})})})}} style={{...S.ip,width:60,padding:'4px',fontSize:11,textAlign:'center'}}/></div><div><div style={{fontSize:8,color:'var(--muted)'}}>ROUNDS/EXO</div><input type="number" value={sessions[activeSession].tabata_rounds||8} onChange={function(e){var v=parseInt(e.target.value)||8;setSessions(function(s){return s.map(function(sess,i){if(i!==activeSession)return sess;return Object.assign({},sess,{tabata_rounds:v})})})}} style={{...S.ip,width:60,padding:'4px',fontSize:11,textAlign:'center'}}/></div></div>}
            {sessions[activeSession].mode==='amrap'&&<div><div style={{fontSize:8,color:'var(--muted)'}}>DURÉE (min)</div><input type="number" value={sessions[activeSession].duration||10} onChange={function(e){var v=parseInt(e.target.value)||10;setSessions(function(s){return s.map(function(sess,i){if(i!==activeSession)return sess;return Object.assign({},sess,{duration:v*60})})})}} style={{...S.ip,width:60,padding:'4px',fontSize:11,textAlign:'center'}}/></div>}
            {sessions[activeSession].mode==='emom'&&<div><div style={{fontSize:8,color:'var(--muted)'}}>MINUTES</div><input type="number" value={sessions[activeSession].emom_minutes||10} onChange={function(e){var v=parseInt(e.target.value)||10;setSessions(function(s){return s.map(function(sess,i){if(i!==activeSession)return sess;return Object.assign({},sess,{emom_minutes:v})})})}} style={{...S.ip,width:60,padding:'4px',fontSize:11,textAlign:'center'}}/></div>}
            <div style={{fontSize:10,color:'#555',marginTop:6,lineHeight:1.5}}>{(function(){var m=sessions[activeSession].mode||'normal';var info={normal:'Séries et répétitions classiques.',circuit:'🔄 Les exercices défilent automatiquement avec les durées indiquées.',tabata:'⚡ Intervalles haute intensité. Travail/repos par rounds.',amrap:'💀 Fais le maximum de tours dans le temps imparti.',fortime:'⏱️ Termine tous les exercices le plus vite possible.',emom:'⏰ Chaque minute, réalise l\'exercice prescrit.'};return info[m]||''})()}</div>
            <button onClick={function(){
              // Find last item index before first separator (or -1 if no items)
              var lastIdx = -1
              var items = sessions[activeSession].items
              for (var j = 0; j < items.length; j++) {
                if (items[j].type === 'separator') break
                lastIdx = j
              }
              setInsertAtIdx(lastIdx); setShowAddEx(true)
            }} style={{marginTop:8,width:'100%',padding:'8px',background:'rgba(196,151,58,0.04)',border:'1px dashed rgba(196,151,58,0.2)',borderRadius:8,color:GOLD,fontSize:11,cursor:'pointer',fontFamily:'Outfit'}}>+ Exercice dans ce bloc</button>
          </div>
          {sessions[activeSession].items.map(function(item,ii){
            // Compute block mode for this item
            var curBM = sessions[activeSession].mode || 'normal'
            for (var bi = 0; bi < ii; bi++) { if (sessions[activeSession].items[bi].type === 'separator') curBM = sessions[activeSession].items[bi].mode || 'normal' }
            var inCircuitBlock = curBM !== 'normal'
            if(item.type==='separator') return (
              <div key={ii} style={{background:'rgba(196,151,58,0.04)',border:'1px solid rgba(196,151,58,0.15)',borderRadius:10,padding:12,marginBottom:6}}>
                <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:6}}>
                  <div style={{flex:1,height:1,background:GOLD,opacity:0.3}}/>
                  <input value={item.name} onChange={function(e){updateItem(activeSession,ii,'name',e.target.value)}} style={{background:'transparent',border:'none',color:GOLD,fontSize:12,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.1em',textAlign:'center',outline:'none',fontFamily:'Outfit',width:150}} />
                  <div style={{flex:1,height:1,background:GOLD,opacity:0.3}}/>
                  <button onClick={function(){moveItem(activeSession,ii,-1)}} style={{...S.sm,fontSize:10}}>↑</button>
                  <button onClick={function(){moveItem(activeSession,ii,1)}} style={{...S.sm,fontSize:10}}>↓</button>
                  <button onClick={function(){removeItem(activeSession,ii)}} style={{...S.sm,fontSize:10}}>✕</button>
                </div>
                <div style={{display:'flex',gap:4,alignItems:'center',flexWrap:'wrap'}}>
                  {[{v:'normal',l:'🏋️ Séries'},{v:'circuit',l:'🔄 Circuit'},{v:'tabata',l:'⚡ Tabata'},{v:'amrap',l:'💀 AMRAP'},{v:'fortime',l:'⏱️ For Time'},{v:'emom',l:'⏰ EMOM'}].map(function(opt){
                    var isActive = (item.mode||'normal') === opt.v
                    return <button key={opt.v} onClick={function(){updateItem(activeSession,ii,'mode',opt.v)}} style={{background:isActive?GOLD:'var(--surface2)',color:isActive?'#000':'var(--text)',border:isActive?'2px solid '+GOLD:'1px solid var(--border)',borderRadius:8,padding:'5px 10px',fontSize:11,fontWeight:isActive?600:400,cursor:'pointer',fontFamily:'Outfit',transition:'all 0.15s'}}>{opt.l}</button>
                  })}
                  {item.mode==='circuit'&&<div style={{display:'flex',gap:4,alignItems:'center'}}><span style={{fontSize:9,color:'#555'}}>Tours</span><input type="number" value={(item.block_settings||{}).rounds||1} onChange={function(e){updateItem(activeSession,ii,'block_settings',Object.assign({},item.block_settings||{},{rounds:parseInt(e.target.value)||1}))}} style={{...S.ip,width:40,padding:'3px',fontSize:10,textAlign:'center'}}/></div>}
                  {item.mode==='tabata'&&<div style={{display:'flex',gap:4,alignItems:'center'}}><span style={{fontSize:9,color:'#555'}}>W</span><input type="number" value={(item.block_settings||{}).tabata_work||20} onChange={function(e){updateItem(activeSession,ii,'block_settings',Object.assign({},item.block_settings||{},{tabata_work:parseInt(e.target.value)||20}))}} style={{...S.ip,width:35,padding:'3px',fontSize:10,textAlign:'center'}}/><span style={{fontSize:9,color:'#555'}}>R</span><input type="number" value={(item.block_settings||{}).tabata_rest||10} onChange={function(e){updateItem(activeSession,ii,'block_settings',Object.assign({},item.block_settings||{},{tabata_rest:parseInt(e.target.value)||10}))}} style={{...S.ip,width:35,padding:'3px',fontSize:10,textAlign:'center'}}/><span style={{fontSize:9,color:'#555'}}>Rds</span><input type="number" value={(item.block_settings||{}).tabata_rounds||8} onChange={function(e){updateItem(activeSession,ii,'block_settings',Object.assign({},item.block_settings||{},{tabata_rounds:parseInt(e.target.value)||8}))}} style={{...S.ip,width:35,padding:'3px',fontSize:10,textAlign:'center'}}/></div>}
                  {item.mode==='amrap'&&<div style={{display:'flex',gap:4,alignItems:'center'}}><span style={{fontSize:9,color:'#555'}}>Min</span><input type="number" value={(item.block_settings||{}).duration||10} onChange={function(e){updateItem(activeSession,ii,'block_settings',Object.assign({},item.block_settings||{},{duration:parseInt(e.target.value)||10}))}} style={{...S.ip,width:40,padding:'3px',fontSize:10,textAlign:'center'}}/></div>}
                  {item.mode==='emom'&&<div style={{display:'flex',gap:4,alignItems:'center'}}><span style={{fontSize:9,color:'#555'}}>Min</span><input type="number" value={(item.block_settings||{}).emom_minutes||10} onChange={function(e){updateItem(activeSession,ii,'block_settings',Object.assign({},item.block_settings||{},{emom_minutes:parseInt(e.target.value)||10}))}} style={{...S.ip,width:40,padding:'3px',fontSize:10,textAlign:'center'}}/></div>}
                </div>
                <div style={{fontSize:9,color:'#555',marginTop:4}}>{(function(){var m=item.mode||'normal';var d={normal:'Exercices en séries/reps classiques',circuit:'Exercices enchaînés avec timer automatique',tabata:'Intervalles travail/repos haute intensité',amrap:'Maximum de tours dans le temps imparti',fortime:'Terminer le plus rapidement possible',emom:'Un exercice par minute'};return d[m]||''})()}</div>
                <button onClick={function(){
                  // Find last item index before next separator
                  var lastIdx = ii
                  for (var j = ii + 1; j < sessions[activeSession].items.length; j++) {
                    if (sessions[activeSession].items[j].type === 'separator') break
                    lastIdx = j
                  }
                  setInsertAtIdx(lastIdx); setShowAddEx(true)
                }} style={{marginTop:8,width:'100%',padding:'8px',background:'rgba(196,151,58,0.04)',border:'1px dashed rgba(196,151,58,0.2)',borderRadius:8,color:GOLD,fontSize:11,cursor:'pointer',fontFamily:'Outfit'}}>+ Exercice dans ce bloc</button>
              </div>
            )
            var pe=item,ex=item.exercise
            var setsDetail=pe.sets_detail&&pe.sets_detail.length>0?pe.sets_detail:(function(){var arr=[];for(var sd=0;sd<(pe.sets||3);sd++)arr.push({t:'work',w:'',r:''});return arr})()
            var ssGroup=pe.superset_group
            var prevItem=ii>0?sessions[activeSession].items[ii-1]:null
            var nextItem=ii<sessions[activeSession].items.length-1?sessions[activeSession].items[ii+1]:null
            var prevSS=prevItem&&prevItem.superset_group===ssGroup&&ssGroup
            var nextSS=nextItem&&nextItem.superset_group===ssGroup&&ssGroup
            var isFirstSS=ssGroup&&!prevSS
            var isLastSS=ssGroup&&!nextSS
            return <div key={ii} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:nextSS?'10px 10px 0 0':prevSS&&nextSS?'0':'0 0 10px 10px',borderRadiusX:ssGroup?(isFirstSS?'10px 10px 0 0':isLastSS?'0 0 10px 10px':'0'):10,borderTopLeftRadius:!ssGroup||isFirstSS?10:0,borderTopRightRadius:!ssGroup||isFirstSS?10:0,borderBottomLeftRadius:!ssGroup||isLastSS?10:0,borderBottomRightRadius:!ssGroup||isLastSS?10:0,padding:12,marginBottom:nextSS?0:6,borderLeft:ssGroup?'3px solid '+GOLD:'none',borderTop:prevSS?'1px dashed rgba(196,151,58,0.2)':'1px solid var(--border)'}}>

              {/* Superset header on first exercise */}
              {isFirstSS&&<div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,padding:'4px 8px',background:'rgba(196,151,58,0.06)',borderRadius:6}}>
                <span style={{fontSize:11,fontWeight:600,color:GOLD}}>🔗 Superset <InfoBubble text="Les exercices en superset s'enchaînent sans repos. Le repos se prend uniquement après avoir fait tous les exercices du groupe = 1 tour." /></span>
                <span style={{fontSize:9,color:'#555'}}>Tours :</span>
                <input type="number" value={pe.superset_rounds||3} onChange={function(e){
                  var v=parseInt(e.target.value)||1; var grp=ssGroup
                  setSessions(function(s){return s.map(function(sess,si){if(si!==activeSession)return sess;return Object.assign({},sess,{items:sess.items.map(function(it){if(it.superset_group!==grp)return it;var newSD=[];for(var kk=0;kk<v;kk++){newSD.push((it.sets_detail&&it.sets_detail[kk])||{t:'work',w:'',r:''})};return Object.assign({},it,{superset_rounds:v,sets:v,sets_detail:newSD})})})})})
                }} style={{...S.ip,width:45,padding:'3px',fontSize:11,textAlign:'center'}} />
                <span style={{fontSize:9,color:'#555',marginLeft:'auto'}}>Repos après tour :</span>
                <input type="number" value={pe.superset_rest||60} onChange={function(e){
                  var v=parseInt(e.target.value)||0
                  updateItem(activeSession,ii,'superset_rest',v)
                }} style={{...S.ip,width:45,padding:'3px',fontSize:11,textAlign:'center'}} />
                <span style={{fontSize:8,color:'#555'}}>s</span>
              </div>}

              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}><span style={{fontSize:11,color:'var(--muted)',fontWeight:600}}>{ii+1}</span>{ex&&ex.gif_url&&<img src={ex.gif_url} onClick={function(){setZoomImg(ex.gif_url)}} style={{width:28,height:28,borderRadius:4,objectFit:'cover',cursor:'pointer'}}/>}<div><div style={{fontSize:13,fontWeight:500}}>{ex&&ex.name||'?'}</div><div style={{fontSize:9,color:GOLD}}>{ex&&ex.muscle_group||''}{ssGroup&&!isLastSS?' · pas de repos':''}
                </div></div></div>
                <div style={{display:'flex',gap:3}}>
                  <button onClick={function(){
                    var items=sessions[activeSession].items
                    if(ssGroup){
                      // Remove from superset
                      updateItem(activeSession,ii,'superset_group',null)
                      updateItem(activeSession,ii,'superset_rounds',null)
                    } else {
                      // Create superset with next exercise
                      var g='ss-'+Date.now()
                      updateItem(activeSession,ii,'superset_group',g)
                      if(items[ii+1]&&items[ii+1].type==='exercise'){
                        updateItem(activeSession,ii+1,'superset_group',g)
                        // Sync sets count
                        var rounds=pe.sets||3
                        updateItem(activeSession,ii,'superset_rounds',rounds)
                        updateItem(activeSession,ii+1,'superset_rounds',rounds)
                        updateItem(activeSession,ii+1,'sets',rounds)
                      }
                    }
                  }} title="Superset" style={{...S.sm,color:ssGroup?GOLD:'var(--muted)',fontSize:10,fontWeight:ssGroup?700:400}}>SS</button>
                  <button onClick={function(){moveItem(activeSession,ii,-1)}} style={S.sm}>↑</button>
                  <button onClick={function(){moveItem(activeSession,ii,1)}} style={S.sm}>↓</button>
                  <button onClick={function(){removeItem(activeSession,ii)}} style={{...S.sm,color:'#f87171'}}>✕</button>
                </div>
              </div>
              {curBM === 'circuit' ? (
                <div style={{display:'flex',gap:6,marginBottom:6,alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{fontSize:10,fontWeight:600,color:GOLD,padding:'4px 8px',background:'rgba(196,151,58,0.1)',borderRadius:6}}>⏱️ Durée</span>
                  <div style={{display:'flex',gap:2,alignItems:'center'}}><input type="number" value={Math.floor((pe.rep_min||0)/60)} onChange={function(e){var m=parseInt(e.target.value)||0;var s=(pe.rep_min||0)%60;var total=m*60+s;updateItem(activeSession,ii,'rep_min',total);updateItem(activeSession,ii,'rep_max',total);updateItem(activeSession,ii,'rep_mode','duration')}} placeholder="0" style={{...S.ip,width:44,padding:'4px',fontSize:11,textAlign:'center'}}/><span style={{fontSize:9,color:'#555'}}>min</span><input type="number" value={(pe.rep_min||0)%60} onChange={function(e){var s=parseInt(e.target.value)||0;var m=Math.floor((pe.rep_min||0)/60);var total=m*60+s;updateItem(activeSession,ii,'rep_min',total);updateItem(activeSession,ii,'rep_max',total);updateItem(activeSession,ii,'rep_mode','duration')}} placeholder="00" style={{...S.ip,width:44,padding:'4px',fontSize:11,textAlign:'center'}}/><span style={{fontSize:9,color:'#555'}}>sec</span></div>
                  <span style={{fontSize:9,color:'var(--muted)',marginLeft:8}}>⏸️ Transition</span>
                  <div style={{display:'flex',gap:2,alignItems:'center'}}><input type="number" value={Math.floor((pe.rest_seconds||0)/60)} onChange={function(e){var m=parseInt(e.target.value)||0;var s=(pe.rest_seconds||0)%60;updateItem(activeSession,ii,'rest_seconds',m*60+s)}} style={{...S.ip,width:38,padding:'4px',fontSize:11,textAlign:'center'}}/><span style={{fontSize:9,color:'#555'}}>:</span><input type="number" value={(pe.rest_seconds||0)%60} onChange={function(e){var s=parseInt(e.target.value)||0;var m=Math.floor((pe.rest_seconds||0)/60);updateItem(activeSession,ii,'rest_seconds',m*60+s)}} style={{...S.ip,width:38,padding:'4px',fontSize:11,textAlign:'center'}}/></div>
                </div>
              ) : curBM === 'tabata' ? (
                <div style={{fontSize:10,color:'var(--muted)',marginBottom:6,padding:'6px 8px',background:'rgba(196,151,58,0.04)',borderRadius:6}}>⚡ Tabata — durées gérées par le bloc (travail/repos automatique)</div>
              ) : curBM === 'amrap' || curBM === 'fortime' ? (
                <div style={{display:'flex',gap:6,marginBottom:6,alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{fontSize:10,fontWeight:600,color:GOLD,padding:'4px 8px',background:'rgba(196,151,58,0.1)',borderRadius:6}}>{curBM === 'amrap' ? '💀 Reps' : '⏱️ Reps'}</span>
                  <input type="number" inputMode="numeric" value={pe.rep_min||''} onChange={function(e){var v=parseInt(e.target.value)||0;updateItem(activeSession,ii,'rep_min',v);updateItem(activeSession,ii,'rep_max',v);updateItem(activeSession,ii,'rep_mode','fixed')}} placeholder="reps" style={{...S.ip,width:56,padding:'4px',fontSize:11,textAlign:'center'}}/>
                  <span style={{fontSize:10,color:'var(--muted)'}}>Charge</span>
                  <input type="text" inputMode="decimal" value={pe.notes&&pe.notes.match&&pe.notes.match(/^\d/)?pe.notes:''} onChange={function(e){updateItem(activeSession,ii,'notes',e.target.value)}} placeholder="kg" style={{...S.ip,width:50,padding:'4px',fontSize:11,textAlign:'center'}}/>
                </div>
              ) : curBM === 'emom' ? (
                <div style={{display:'flex',gap:6,marginBottom:6,alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{fontSize:10,fontWeight:600,color:GOLD,padding:'4px 8px',background:'rgba(196,151,58,0.1)',borderRadius:6}}>⏰ EMOM</span>
                  <input type="number" inputMode="numeric" value={pe.rep_min||''} onChange={function(e){var v=parseInt(e.target.value)||0;updateItem(activeSession,ii,'rep_min',v);updateItem(activeSession,ii,'rep_max',v);updateItem(activeSession,ii,'rep_mode','fixed')}} placeholder="reps" style={{...S.ip,width:56,padding:'4px',fontSize:11,textAlign:'center'}}/>
                  <span style={{fontSize:10,color:'var(--muted)'}}>reps par minute</span>
                </div>
              ) : (
              <div style={{display:'flex',gap:6,marginBottom:6,alignItems:'center',flexWrap:'wrap'}}>
                <select value={pe.rep_mode||'range'} onChange={function(e){updateItem(activeSession,ii,'rep_mode',e.target.value)}} style={{...S.ip,width:100,padding:'4px 6px',fontSize:10}}>
                  <option value="range">Intervalle</option>
                  <option value="fixed">Fixe</option>
                  <option value="duration">Durée (s)</option>
                </select>
                {pe.rep_mode!=='duration'&&pe.rep_mode!=='fixed'?<div style={{display:'flex',gap:4,alignItems:'center'}}><input type="number" value={pe.rep_min} onChange={function(e){updateItem(activeSession,ii,'rep_min',parseInt(e.target.value)||0)}} style={{...S.ip,width:40,padding:'4px',fontSize:11,textAlign:'center'}}/><span style={{fontSize:10,color:'var(--muted)'}}>à</span><input type="number" value={pe.rep_max} onChange={function(e){updateItem(activeSession,ii,'rep_max',parseInt(e.target.value)||0)}} style={{...S.ip,width:40,padding:'4px',fontSize:11,textAlign:'center'}}/></div>:null}
                {pe.rep_mode==='fixed'?<input type="number" value={pe.rep_min} onChange={function(e){var v=parseInt(e.target.value)||0;updateItem(activeSession,ii,'rep_min',v);updateItem(activeSession,ii,'rep_max',v)}} placeholder="reps" style={{...S.ip,width:56,padding:'4px',fontSize:11,textAlign:'center'}}/>:null}
                {pe.rep_mode==='duration'?<div style={{display:'flex',gap:2,alignItems:'center'}}><input type="number" value={Math.floor((pe.rep_min||0)/60)} onChange={function(e){var m=parseInt(e.target.value)||0;var s=(pe.rep_min||0)%60;var total=m*60+s;updateItem(activeSession,ii,'rep_min',total);updateItem(activeSession,ii,'rep_max',total)}} placeholder="0" style={{...S.ip,width:40,padding:'4px',fontSize:11,textAlign:'center'}}/><span style={{fontSize:9,color:'#555'}}>:</span><input type="number" value={(pe.rep_min||0)%60} onChange={function(e){var s=parseInt(e.target.value)||0;var m=Math.floor((pe.rep_min||0)/60);var total=m*60+s;updateItem(activeSession,ii,'rep_min',total);updateItem(activeSession,ii,'rep_max',total)}} placeholder="00" style={{...S.ip,width:40,padding:'4px',fontSize:11,textAlign:'center'}}/></div>:null}
                {!ssGroup&&<span style={{fontSize:10,color:'var(--muted)',marginLeft:'auto'}}>Repos</span>}
                {!ssGroup&&<div style={{display:'flex',gap:2,alignItems:'center'}}><input type="number" value={Math.floor((pe.rest_seconds||0)/60)} onChange={function(e){var m=parseInt(e.target.value)||0;var s=(pe.rest_seconds||0)%60;updateItem(activeSession,ii,'rest_seconds',m*60+s)}} style={{...S.ip,width:38,padding:'4px',fontSize:11,textAlign:'center'}}/><span style={{fontSize:9,color:'#555'}}>:</span><input type="number" value={(pe.rest_seconds||0)%60} onChange={function(e){var s=parseInt(e.target.value)||0;var m=Math.floor((pe.rest_seconds||0)/60);updateItem(activeSession,ii,'rest_seconds',m*60+s)}} style={{...S.ip,width:38,padding:'4px',fontSize:11,textAlign:'center'}}/></div>}
                {!ssGroup&&<span style={{fontSize:9,color:'var(--muted)'}}>s</span>}
              </div>
              )}
              {curBM === 'normal' && (<div>
              <div style={{display:'grid',gridTemplateColumns:ssGroup?'35px 1fr 1fr 28px':'35px 1fr 1fr 70px 28px',gap:3,marginBottom:2}}>
                <div style={{fontSize:7,fontWeight:600,color:'#555',textTransform:'uppercase',textAlign:'center'}}>SÉRIE</div>
                <div style={{fontSize:7,fontWeight:600,color:'#555',textTransform:'uppercase',textAlign:'center'}}>KG</div>
                <div style={{fontSize:7,fontWeight:600,color:'#555',textTransform:'uppercase',textAlign:'center'}}>{pe.rep_mode==='duration'?'MIN:SEC':'REPS'}</div>
                {!ssGroup&&<div style={{fontSize:7,fontWeight:600,color:'#555',textTransform:'uppercase',textAlign:'center'}}>REPOS</div>}
                <div></div>
              </div>
              {setsDetail.map(function(set,si2){
                var setType=set.t||'work'
                var typeColors={warmup:{bg:'rgba(96,165,250,0.06)',label:'E',color:'#60a5fa'},work:{bg:'transparent',label:''+(si2+1-setsDetail.slice(0,si2).filter(function(x){return x.t==='warmup'||x.t==='drop'}).length),color:'#888'},failure:{bg:'rgba(248,113,113,0.06)',label:'F',color:'#f87171'},drop:{bg:'rgba(168,85,247,0.06)',label:'D',color:'#a855f7'}}
                var tc=typeColors[setType]||typeColors.work
                return <div key={si2} style={{display:'grid',gridTemplateColumns:ssGroup?'35px 1fr 1fr 28px':'35px 1fr 1fr 70px 28px',gap:3,alignItems:'center',padding:'3px 0',background:tc.bg,borderRadius:4}}>
                  <button onClick={function(){
                    var types=['work','warmup','failure','drop']
                    var el=document.createElement('div');el.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center;z-index:9999'
                    var inner=document.createElement('div');inner.style.cssText='background:var(--surface,#1a1a1a);border-radius:16px 16px 0 0;padding:20px;width:100%;max-width:400px;border:1px solid var(--border,#333)'
                    inner.innerHTML='<div style="text-align:center;font-size:14px;font-weight:600;margin-bottom:16px;font-family:Outfit">Sélectionner le Type de Série</div>'
                    types.forEach(function(tp){
                      var tl={work:{l:'1',n:'Série Normale',c:'#888',desc:'Série de travail standard avec le poids cible.'},warmup:{l:'W',n:"Série d'Échauffement",c:'#60a5fa',desc:'Série légère pour préparer les muscles et les articulations. Non comptée dans le volume de travail.'},failure:{l:'F',n:'Série Ratée',c:'#f87171',desc:'Tu n\'as pas atteint le nombre de répétitions visé. Utile pour tracker la fatigue et ajuster les charges.'},drop:{l:'D',n:'Série Drop',c:'#a855f7',desc:'Réduction immédiate du poids sans temps de repos. Permet de prolonger l\'effort au-delà de l\'échec.'}}[tp]
                      var btn=document.createElement('button');btn.style.cssText='display:flex;align-items:center;gap:14px;width:100%;padding:14px 16px;background:none;border:none;border-top:1px solid var(--border,#333);cursor:pointer;font-family:Outfit;color:var(--text,#fff);font-size:13px;text-align:left'
                      btn.innerHTML='<span style="font-size:16px;font-weight:700;color:'+tl.c+';width:24px;text-align:center">'+tl.l+'</span><span style="flex:1">'+tl.n+'</span>'
                      var helpBtn=document.createElement('span');helpBtn.textContent='❓';helpBtn.style.cssText='font-size:16px;padding:4px 8px;cursor:pointer'
                      helpBtn.onclick=function(ev){ev.stopPropagation();var tip=document.createElement('div');tip.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px';tip.innerHTML='<div style="background:var(--surface,#1a1a1a);border:1px solid var(--border,#333);border-radius:12px;padding:20px;max-width:320px;width:100%"><div style="font-size:16px;font-weight:700;color:'+tl.c+';margin-bottom:8px">'+tl.l+' '+tl.n+'</div><div style="font-size:13px;color:var(--text,#ccc);line-height:1.6">'+tl.desc+'</div><button style="margin-top:14px;width:100%;padding:10px;background:var(--surface2,#2a2a2a);border:none;border-radius:8px;color:var(--text,#fff);font-family:Outfit;font-size:13px;cursor:pointer" onclick="this.closest(\'div[style*=fixed]\').remove()">OK</button></div>';document.body.appendChild(tip)}
                      btn.appendChild(helpBtn)
                      btn.onclick=function(){var newSD=setsDetail.map(function(s,k){if(k!==si2)return s;return Object.assign({},s,{t:tp})});updateItem(activeSession,ii,'sets_detail',newSD);document.body.removeChild(el)}
                      inner.appendChild(btn)
                    })
                    var removeBtn=document.createElement('button');removeBtn.style.cssText='display:flex;align-items:center;gap:14px;width:100%;padding:14px 16px;background:none;border:none;border-top:1px solid var(--border,#333);cursor:pointer;font-family:Outfit;color:#f87171;font-size:13px'
                    removeBtn.innerHTML='<span style="font-size:16px;width:24px;text-align:center">✕</span><span>Retirer la Série</span>'
                    removeBtn.onclick=function(){var newSD=setsDetail.filter(function(_,k){return k!==si2});if(newSD.length===0)newSD=[{t:'work',w:'',r:''}];updateItem(activeSession,ii,'sets_detail',newSD);updateItem(activeSession,ii,'sets',newSD.length);document.body.removeChild(el)}
                    inner.appendChild(removeBtn)
                    var cancelBtn=document.createElement('button');cancelBtn.style.cssText='width:100%;padding:12px;margin-top:8px;background:var(--surface2,#2a2a2a);border:none;border-radius:10px;cursor:pointer;font-family:Outfit;color:var(--text,#fff);font-size:13px'
                    cancelBtn.textContent='Annuler';cancelBtn.onclick=function(){document.body.removeChild(el)}
                    inner.appendChild(cancelBtn)
                    el.appendChild(inner);el.onclick=function(ev){if(ev.target===el)document.body.removeChild(el)};document.body.appendChild(el)
                  }} style={{background:'none',border:'none',fontSize:13,fontWeight:700,color:tc.color,cursor:'pointer',fontFamily:'Outfit',textAlign:'center',padding:'4px'}}>{tc.label}</button>
                  <input inputMode="decimal" value={set.w||''} onChange={function(e){var newSD=setsDetail.map(function(s,k){if(k!==si2)return s;return Object.assign({},s,{w:e.target.value})});updateItem(activeSession,ii,'sets_detail',newSD)}} placeholder="—" style={{...S.ip,padding:'6px 4px',fontSize:12,textAlign:'center',background:tc.bg||'var(--surface2)'}}/>
                  <input inputMode="numeric" value={set.r||''} onChange={function(e){var newSD=setsDetail.map(function(s,k){if(k!==si2)return s;return Object.assign({},s,{r:e.target.value})});updateItem(activeSession,ii,'sets_detail',newSD)}} placeholder={pe.rep_min===pe.rep_max?''+pe.rep_min:pe.rep_min+'-'+pe.rep_max} style={{...S.ip,padding:'6px 4px',fontSize:12,textAlign:'center',background:tc.bg||'var(--surface2)'}}/>
                  {!ssGroup&&(function(){var restVal=parseInt(set.rest)||(pe.rest_seconds||90);return <select value={set.rest||''} onChange={function(e){var newSD=setsDetail.map(function(s,k){if(k!==si2)return s;return Object.assign({},s,{rest:e.target.value})});updateItem(activeSession,ii,'sets_detail',newSD)}} style={{...S.ip,padding:'2px',fontSize:11,width:68,background:tc.bg||'var(--surface2)',textAlign:'center'}}><option value="">{Math.floor(restVal/60)}:{String(restVal%60).padStart(2,'0')}</option>{(function(){var opts=[];for(var t=0;t<=300;t+=5){opts.push(<option key={t} value={t}>{Math.floor(t/60)}:{String(t%60).padStart(2,'0')}</option>)};return opts})()}</select>})()}
                  <button title="Dupliquer cette série" onClick={function(){var copy=Object.assign({},set);var newSD=setsDetail.slice(0,si2+1).concat([copy]).concat(setsDetail.slice(si2+1));updateItem(activeSession,ii,'sets_detail',newSD);updateItem(activeSession,ii,'sets',newSD.length)}} style={{background:'none',border:'none',cursor:'pointer',padding:'2px 4px',fontSize:12,color:'var(--muted)',opacity:0.5}}>📋</button>
                </div>
              })}
              <div style={{display:'flex',gap:6,marginTop:6}}>
                <button onClick={function(){var lastW=setsDetail.length>0?setsDetail[setsDetail.length-1].w:'';var newSD=setsDetail.concat([{t:'work',w:lastW,r:''}]);updateItem(activeSession,ii,'sets_detail',newSD);updateItem(activeSession,ii,'sets',newSD.length)}} style={{...S.bk,border:'1px dashed var(--border)',borderRadius:6,padding:'5px 12px',fontSize:11}}>+ Série</button>
                {setsDetail.length>1&&<button onClick={function(){var newSD=setsDetail.slice(0,-1);updateItem(activeSession,ii,'sets_detail',newSD);updateItem(activeSession,ii,'sets',newSD.length)}} style={{...S.bk,border:'1px dashed var(--border)',borderRadius:6,padding:'5px 12px',fontSize:11,color:'#f87171'}}>− Série</button>}
              </div>
              </div>)}
              <input value={pe.notes||''} onChange={function(e){updateItem(activeSession,ii,'notes',e.target.value)}} placeholder="💬 Consignes coach (ex: Descends sur 3s, coudes serrés...)" style={{...S.ip,padding:'8px 10px',fontSize:11,marginTop:6,width:'100%',boxSizing:'border-box',borderColor:pe.notes?'rgba(196,151,58,0.3)':'var(--border)',background:pe.notes?'rgba(196,151,58,0.03)':'var(--surface)'}}/>
              <div style={{display:'flex',gap:6,marginTop:4,alignItems:'center'}}>
                <button onClick={function(){openAlternatives(ii,pe.exercise)}} style={{...S.bk,border:'1px dashed var(--border)',borderRadius:5,padding:'3px 10px',fontSize:10,color:GOLD}}>🔄 Alternatives {pe.alternative_ids?'('+JSON.parse(pe.alternative_ids).length+')':''}</button>
              </div>
            </div>
          })}
          <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}><button onClick={function(){setShowAddEx(true)}} style={{...S.bt,flex:1}}>+ Exercice</button><button onClick={addSeparator} style={{...S.bk,border:'1px dashed var(--border)',padding:'8px 14px',borderRadius:8}}>+ Bloc</button><button onClick={function(){setShowInsertBlock(true)}} style={{...S.bk,border:'1px dashed var(--border)',padding:'8px 14px',borderRadius:8}}>📦 Insérer</button></div>
          {sessions[activeSession].items.filter(function(x){return x.type==='exercise'}).length>0&&<button onClick={function(){setShowSaveBlock(true)}} style={{...S.bk,fontSize:10,marginBottom:12}}>💾 Sauvegarder cette séance comme bloc</button>}

          {/* Insert block modal */}
          {showInsertBlock&&<div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:14,marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:500,marginBottom:10}}>📦 Insérer un bloc</div>
            {savedBlocks.length===0&&<div style={{color:'var(--muted)',fontSize:12,padding:10}}>Aucun bloc sauvegardé</div>}
            {savedBlocks.map(function(block){return <button key={block.id} onClick={function(){insertBlock(block)}} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'10px 12px',background:'transparent',border:'1px solid var(--border)',borderRadius:7,cursor:'pointer',marginBottom:4,fontFamily:'Outfit',color:'var(--text)',textAlign:'left',fontSize:12}}>
              <span style={{fontSize:16}}>📦</span>
              <div style={{flex:1}}><div style={{fontWeight:500}}>{block.name}</div><div style={{fontSize:10,color:'var(--muted)'}}>{(block.exercises||[]).length} exercices</div></div>
              <span style={{color:GOLD}}>+ Insérer</span>
            </button>})}
            <button onClick={function(){setShowInsertBlock(false)}} style={S.bk}>Fermer</button>
          </div>}

          {/* Save as block modal */}
          {showSaveBlock&&<div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:14,marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:500,marginBottom:8}}>💾 Sauvegarder comme bloc</div>
            <div style={{fontSize:11,color:'var(--muted)',marginBottom:8}}>Les exercices de cette séance seront sauvegardés comme bloc réutilisable</div>
            <input value={saveBlockName} onChange={function(e){setSaveBlockName(e.target.value)}} placeholder="Nom du bloc (ex: Échauffement haut du corps)" style={{...S.ip,fontSize:12,padding:'8px 10px',marginBottom:8}}/>
            <div style={{display:'flex',gap:8}}><button onClick={saveCurrentAsBlock} disabled={!saveBlockName.trim()} style={S.bt}>💾 Sauvegarder</button><button onClick={function(){setShowSaveBlock(false)}} style={S.bk}>Annuler</button></div>
          </div>}
          {showAddEx&&<div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'var(--bg)',zIndex:100,display:'flex',flexDirection:'column',padding:0}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',borderBottom:'1px solid var(--border)'}}>
              <div style={{fontSize:15,fontWeight:600,fontFamily:'Outfit'}}>Ajouter un exercice</div>
              <button onClick={function(){setShowAddEx(false)}} style={{background:'none',border:'none',fontSize:18,color:'var(--muted)',cursor:'pointer',padding:4}}>✕</button>
            </div>
            <div style={{padding:'12px 16px',flex:1,overflow:'auto'}}>
            <input placeholder="🔍 Rechercher" value={searchQ} onChange={function(e){setSearchQ(e.target.value)}} style={{...S.ip,marginBottom:6,padding:'7px 10px',fontSize:12}} autoFocus/>
            <div style={{display:'flex',gap:4,marginBottom:8}}>
              <select value={progExMuscle} onChange={function(e){setProgExMuscle(e.target.value)}} style={{...S.ip,flex:1,fontSize:10,padding:'5px'}}><option value="">Tous les muscles</option>{allMuscles.map(function(m){return <option key={m}>{m}</option>})}</select>
              <select value={progExEquip} onChange={function(e){setProgExEquip(e.target.value)}} style={{...S.ip,flex:1,fontSize:10,padding:'5px'}}><option value="">Tout l'équipement</option>{allEquip.map(function(e){return <option key={e}>{e}</option>})}</select>
            </div>
            <div style={{maxHeight:250,overflow:'auto'}}>{exercises.filter(function(e){
              if(progExMuscle&&(e.muscle_group||'').split(',').map(function(m){return m.trim()}).indexOf(progExMuscle)<0)return false
              if(progExEquip&&e.equipment!==progExEquip)return false
              if(searchQ&&!norm(e.name).includes(norm(searchQ))&&!norm(e.muscle_group).includes(norm(searchQ)))return false
              return true
            }).map(function(ex){var addedCount=sessions[activeSession]?sessions[activeSession].items.filter(function(it){return it.type==='exercise'&&it.exercise_id===ex.id}).length:0;return <button key={ex.id} onClick={function(){addExToSession(ex)}} style={{display:'flex',alignItems:'center',gap:6,width:'100%',padding:'6px 8px',background:addedCount>0?'rgba(74,222,128,0.08)':'transparent',border:addedCount>0?'1px solid rgba(74,222,128,0.25)':'1px solid var(--border)',borderRadius:5,cursor:'pointer',marginBottom:2,fontFamily:'Outfit',color:'var(--text)',textAlign:'left',fontSize:11}}>{ex.gif_url&&<img src={ex.gif_url} onClick={function(e){e.stopPropagation();setZoomImg(ex.gif_url)}} style={{width:36,height:36,borderRadius:4,objectFit:'cover',cursor:'zoom-in'}}/>}<div style={{flex:1}}>{ex.name}{addedCount>0&&<span style={{marginLeft:6,fontSize:9,color:'#4ade80',fontWeight:700}}>✓ ×{addedCount}</span>}</div><span style={{fontSize:9,color:GOLD}}>{ex.muscle_group}</span><span style={{marginLeft:4,fontSize:14,color:GOLD}}>+</span></button>})}</div>
            <button onClick={function(){setShowAddEx(false);setProgExMuscle('');setProgExEquip('')}} style={S.bk}>Fermer</button>
          </div></div>}
        </div>}
        {/* Live Training: optional client selector */}
        {(liveTrainingActive || liveClient) && clients && clients.length > 0 && (
          <div style={{background:'rgba(74,222,128,0.04)',border:'1px solid rgba(74,222,128,0.2)',borderRadius:12,padding:12,marginTop:14}}>
            <div style={{fontSize:11,fontWeight:600,color:'#4ade80',marginBottom:6}}>🎯 Live Training — Client (optionnel)</div>
            <select value={liveClient} onChange={function(e){setLiveClient(e.target.value)}} style={{...S.ip,fontSize:12,padding:'6px 8px'}}>
              <option value="">Coach seul / sans client</option>
              {clients.map(function(c){return <option key={c.id} value={c.id}>{c.full_name||c.email}</option>})}
            </select>
          </div>
        )}

        <div style={{display:'flex',gap:10,marginTop:14,flexWrap:'wrap'}}>
          <button onClick={saveProgram} style={S.bt}>💾 {editingProg?'Enregistrer':'Créer'}</button>
          {sessions.length > 0 && sessions[activeSession] && sessions[activeSession].items.filter(function(it){return it.type==='exercise'}).length > 0 && (
            <button onClick={function(){
              var sess = sessions[activeSession]
              var exItems = sess.items.filter(function(it){return it.type==='exercise'})
              var peList = exItems.map(function(ex,i){return{exercise_id:ex.exercise_id,exercises:ex.exerciseData||exercises.find(function(e){return e.id===ex.exercise_id}),sets:ex.sets||3,rep_min:ex.rep_min||8,rep_max:ex.rep_max||12,rep_mode:ex.rep_mode||'range',rest_seconds:ex.rest_seconds||90,order_index:i,notes:ex.notes||''}})
              // Build blocks from separators - assign mode to each exercise
              var exBlocks = []
              var curMode = 'normal'; var curName = ''; var curSettings = {}
              sess.items.forEach(function(it) {
                if (it.type === 'separator') {
                  curMode = it.mode || 'normal'
                  curName = it.name || ''
                  curSettings = it.block_settings || {}
                } else if (it.type === 'exercise') {
                  exBlocks.push({ mode: curMode, name: curName, settings: curSettings })
                }
              })
              // Group consecutive exercises with same mode+name into blocks
              var blocks = []
              exBlocks.forEach(function(eb, idx) {
                var last = blocks.length > 0 ? blocks[blocks.length - 1] : null
                if (last && last.mode === eb.mode && last.name === eb.name) {
                  last.endIdx = idx
                } else {
                  blocks.push({ mode: eb.mode, startIdx: idx, endIdx: idx, name: eb.name, settings: eb.settings })
                }
              })
              var pName = progForm.name.trim()||'Live Training'
              var sName = sessions[activeSession].name||'Séance'
              setLiveWorkout({programName:pName+' — '+sName,exercises:peList,blocks:blocks,clientId:liveClient||null})
            }} style={{...S.bt,background:'#4ade80',color:'#000'}}>▶ Lancer la séance</button>
          )}
          <button onClick={function(){tryLeaveProgram('programs')}} style={S.bk}>Annuler</button>
        </div>
      </div>}

      {view==='sport-clients'&&<div>
        <div style={{fontSize:15,fontWeight:500,marginBottom:16}}>👤 Clients — Suivi sport</div>

        {/* Quick assign */}
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'14px',marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:500,marginBottom:8}}>📋 Assigner un programme</div>
          <div style={{display:'flex',gap:6}}>
            <select value={assignProg||''} onChange={function(e){setAssignProg(e.target.value)}} style={{...S.ip,flex:1,fontSize:12}}><option value="">Programme...</option>{programs.filter(function(p){return p.is_template!==false}).map(function(p){return <option key={p.id} value={p.id}>{p.name}</option>})}</select>
            <select value={assignClient} onChange={function(e){setAssignClient(e.target.value)}} style={{...S.ip,flex:1,fontSize:12}}><option value="">Client...</option>{(clients||[]).map(function(c){return <option key={c.id} value={c.id}>{c.full_name||c.email}</option>})}</select>
            <button onClick={assignProgram} disabled={!assignProg||!assignClient} style={{...S.bt,fontSize:12,padding:'8px 14px',whiteSpace:'nowrap'}}>✓</button>
          </div>
        </div>

        {/* Client list */}
        {(clients||[]).filter(function(c){return c.beta_features}).length===0&&<div style={{textAlign:'center',padding:30,color:'var(--muted)',fontSize:13}}>Aucun client avec un programme sport. Assigne un programme ci-dessus.</div>}
        {(clients||[]).filter(function(c){return c.beta_features}).map(function(c){
          var initials=(c.full_name||'?').split(' ').map(function(n){return n[0]||''}).join('').toUpperCase().slice(0,2)
          return (
            <button key={c.id} onClick={function(){if(setCoachClient)setCoachClient(c)}} style={{display:'flex',alignItems:'center',gap:14,width:'100%',padding:'14px 16px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,marginBottom:8,cursor:'pointer',fontFamily:'Outfit',color:'var(--text)',textAlign:'left'}}>
              <div style={{width:44,height:44,borderRadius:'50%',background:'rgba(196,151,58,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:600,color:GOLD,flexShrink:0}}>{initials}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:15,fontWeight:500}}>{c.full_name||c.email}</div>
                <div style={{fontSize:11,color:'var(--muted)'}}>{c.coaching_type==='domicile'?'🏠 Domicile':c.coaching_type==='presentiel'?'🏋️ Présentiel':'📱 En ligne'}</div>
              </div>
              <div style={{fontSize:11,color:GOLD}}>Programmes · Historique · Progression</div>
              <div style={{color:'var(--muted)',fontSize:16}}>›</div>
            </button>
          )
        })}
        <button onClick={function(){setView('home')}} style={{...S.bk,marginTop:12}}>← Sport</button>
      </div>}

      {view==='assign'&&<div>
        <div style={{fontSize:15,fontWeight:500,marginBottom:12}}>Assigner</div>
        <select value={assignProg||''} onChange={function(e){setAssignProg(e.target.value)}} style={{...S.ip,marginBottom:8}}><option value="">Programme...</option>{programs.filter(function(p){return p.is_template!==false}).map(function(p){return <option key={p.id} value={p.id}>{p.name}</option>})}</select>
        <select value={assignClient} onChange={function(e){setAssignClient(e.target.value)}} style={{...S.ip,marginBottom:8}}><option value="">Client...</option>{(clients||[]).map(function(c){return <option key={c.id} value={c.id}>{c.full_name||c.email}</option>})}</select>
        <button onClick={assignProgram} disabled={!assignProg||!assignClient} style={S.bt}>Assigner</button>
        <button onClick={function(){setView('home')}} style={{...S.bk,marginTop:12}}>← Sport</button>
      </div>}

      {/* BLOCKS MANAGER */}
      {view==='blocks'&&<div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:500}}>📦 Blocs réutilisables</div>
        </div>
        <div style={{fontSize:12,color:'var(--muted)',marginBottom:16}}>Crée des blocs en sauvegardant les exercices d'une séance. Insère-les ensuite dans n'importe quel programme.</div>
        {savedBlocks.map(function(block){
          return <div key={block.id} style={S.rw}>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:500}}>📦 {block.name}</div>
              <div style={{fontSize:11,color:GOLD}}>{(block.exercises||[]).length} exercices</div>
            </div>
            <button onClick={function(){deleteBlock(block.id)}} style={{...S.sm,color:'#f87171'}}>✕</button>
          </div>
        })}
        {savedBlocks.length===0&&<div style={{textAlign:'center',padding:30,color:'var(--muted)'}}>Aucun bloc. Crée un programme, puis clique "💾 Sauvegarder comme bloc".</div>}
        <button onClick={function(){setView('programs')}} style={{...S.bk,marginTop:12}}>← Programmes</button>
      </div>}

      {/* VIDEOS */}
      {view==='videos'&&<div>
        <button onClick={function(){setView('list')}} style={{background:'none',border:'none',color:GOLD,fontSize:13,cursor:'pointer',fontFamily:'Outfit',padding:'4px 0',marginBottom:8}}>← Retour</button>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:500}}>🎬 Vidéos</div>
          <button onClick={createFolder} style={S.bt}>+ Dossier</button>
        </div>
        {videoFolders.map(function(folder){
          return <button key={folder.id} onClick={function(){setActiveFolder(folder);setView('video-folder')}} style={{...S.rw,width:'100%',cursor:'pointer',textAlign:'left'}}>
            <div style={{width:44,height:44,borderRadius:10,background:'rgba(196,151,58,0.1)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>📂</div>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:500}}>{folder.name}</div>
              <div style={{fontSize:11,color:'var(--muted)'}}>{(folder.videos||[]).length} vidéo{(folder.videos||[]).length>1?'s':''}</div>
            </div>
            <div style={{fontSize:18,color:'var(--muted)'}}>›</div>
          </button>
        })}
        {videoFolders.length===0&&<div style={{textAlign:'center',padding:30,color:'var(--muted)'}}>Aucun dossier. Crée ton premier !</div>}
        <button onClick={function(){setView('home')}} style={{...S.bk,marginTop:12}}>← Sport</button>
      </div>}

      {/* VIDEO FOLDER - Videos inside */}
      {view==='video-folder'&&activeFolder&&<div>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:500}}>📂 {activeFolder.name}</div>
          <button onClick={function(){deleteFolder(activeFolder.id)}} style={{...S.sm,color:'#f87171'}}>🗑️</button>
        </div>

        {/* Add video form */}
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,padding:14,marginBottom:16}}>
          <div style={{fontSize:12,fontWeight:500,marginBottom:8}}>Ajouter une vidéo</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            <input value={videoForm.title} onChange={function(e){setVideoForm(function(f){return Object.assign({},f,{title:e.target.value})})}} placeholder="Titre de la vidéo" style={{...S.ip,padding:'8px 10px',fontSize:12}}/>
            <input value={videoForm.youtube_url} onChange={function(e){setVideoForm(function(f){return Object.assign({},f,{youtube_url:e.target.value})})}} placeholder="URL YouTube (ex: https://youtu.be/...)" style={{...S.ip,padding:'8px 10px',fontSize:12}}/>
            {videoForm.youtube_url&&getYoutubeId(videoForm.youtube_url)&&<img src={'https://img.youtube.com/vi/'+getYoutubeId(videoForm.youtube_url)+'/mqdefault.jpg'} style={{width:120,borderRadius:6}}/>}
            <button onClick={function(){addVideo(activeFolder.id)}} disabled={!videoForm.title.trim()||!videoForm.youtube_url.trim()} style={S.bt}>+ Ajouter</button>
          </div>
        </div>

        {/* Videos list */}
        {(activeFolder.videos||[]).map(function(vid){
          var ytId=getYoutubeId(vid.youtube_url)
          return <div key={vid.id} style={{display:'flex',gap:12,alignItems:'center',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
            {ytId&&<a href={vid.youtube_url} target="_blank" style={{flexShrink:0}}><img src={'https://img.youtube.com/vi/'+ytId+'/mqdefault.jpg'} style={{width:120,height:68,borderRadius:8,objectFit:'cover'}}/></a>}
            <div style={{flex:1}}>
              <a href={vid.youtube_url} target="_blank" style={{fontSize:13,fontWeight:500,color:'var(--text)',textDecoration:'none'}}>{vid.title}</a>
            </div>
            <button onClick={function(){deleteVideo(vid.id);loadVideos()}} style={{...S.sm,color:'#f87171'}}>✕</button>
          </div>
        })}
        {(activeFolder.videos||[]).length===0&&<div style={{textAlign:'center',padding:20,color:'var(--muted)'}}>Aucune vidéo</div>}
        <button onClick={function(){setView('videos');loadVideos()}} style={{...S.bk,marginTop:12}}>← Vidéos</button>
      </div>}
      {/* Exercise detail modal */}
      {/* Alternatives editor modal */}
      {altEditIdx !== null && <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(6px)',zIndex:250,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={function(){setAltEditIdx(null)}}>
        <div style={{background:'#1a1a1a',borderRadius:'16px 16px 0 0',padding:'20px',width:'100%',maxWidth:480,maxHeight:'60vh',overflow:'auto'}} onClick={function(e){e.stopPropagation()}}>
          <div style={{fontSize:15,fontWeight:500,marginBottom:4}}>🔄 Exercices alternatifs</div>
          <div style={{fontSize:11,color:'#7a7065',marginBottom:16}}>Sélectionnez les alternatives que le client pourra choisir. Elles seront marquées "Préconisé par le coach".</div>
          {altList.map(function(ex){
            var currentAlts = sessions[activeSession].items[altEditIdx].alternative_ids ? JSON.parse(sessions[activeSession].items[altEditIdx].alternative_ids) : []
            var isSelected = currentAlts.indexOf(ex.id) !== -1
            return <button key={ex.id} onClick={function(){
              var item = sessions[activeSession].items[altEditIdx]
              var alts = item.alternative_ids ? JSON.parse(item.alternative_ids) : []
              if (alts.indexOf(ex.id) !== -1) alts = alts.filter(function(a){return a !== ex.id})
              else alts.push(ex.id)
              updateItem(activeSession, altEditIdx, 'alternative_ids', JSON.stringify(alts))
            }} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'10px 12px',background:isSelected?'rgba(196,151,58,0.08)':'rgba(255,255,255,0.03)',border:'1px solid',borderColor:isSelected?'rgba(196,151,58,0.3)':'rgba(255,255,255,0.06)',borderRadius:10,cursor:'pointer',marginBottom:4,fontFamily:'Outfit',color:'#f0ece4',textAlign:'left',fontSize:13}}>
              {ex.gif_url&&<img src={ex.gif_url} style={{width:36,height:36,borderRadius:8,objectFit:'cover'}}/>}
              <div style={{flex:1}}><div>{ex.name}</div>{ex.equipment&&<div style={{fontSize:10,color:'#555'}}>{ex.equipment}</div>}</div>
              <span style={{fontSize:16}}>{isSelected?'⭐':'○'}</span>
            </button>
          })}
          {altList.length===0&&<div style={{color:'#555',textAlign:'center',padding:20}}>Aucun exercice du même muscle</div>}
          <button onClick={function(){setAltEditIdx(null)}} style={{width:'100%',padding:'12px',background:GOLD,border:'none',borderRadius:8,color:'#000',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Outfit',marginTop:12}}>Valider</button>
        </div>
      </div>}

      {detailEx && <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.95)',backdropFilter:'blur(12px)',zIndex:300,overflow:'auto',animation:'fadeIn 0.3s ease'}} onClick={function(){setDetailEx(null)}}>
        <div style={{maxWidth:480,margin:'0 auto',padding:'16px 16px 40px'}} onClick={function(e){e.stopPropagation()}}>
          {/* Close */}
          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:8}}><button onClick={function(){setDetailEx(null)}} style={{background:'rgba(255,255,255,0.08)',border:'none',color:'#999',fontSize:18,cursor:'pointer',padding:'8px 14px',borderRadius:10}}>✕</button></div>

          {/* GIF - large */}
          {detailEx.gif_url&&<div style={{marginBottom:20,background:'#0a0a0a',borderRadius:20,overflow:'hidden',border:'1px solid rgba(255,255,255,0.08)'}}><img src={detailEx.gif_url} style={{width:'100%',maxHeight:360,objectFit:'contain',display:'block'}}/></div>}

          {/* Name + tags */}
          <div style={{marginBottom:20,textAlign:'center'}}>
            <div style={{fontSize:24,fontWeight:700,color:'#f0ece4',marginBottom:8}}>{detailEx.name}</div>
            {detailEx.alias&&<div style={{fontSize:14,color:'#7a7065',marginBottom:10,fontStyle:'italic'}}>{detailEx.alias}</div>}
            <div style={{display:'flex',gap:8,justifyContent:'center',flexWrap:'wrap'}}>
              {detailEx.muscle_group&&<span style={{fontSize:12,padding:'6px 14px',background:'rgba(196,151,58,0.1)',border:'1px solid rgba(196,151,58,0.25)',borderRadius:20,color:GOLD,fontWeight:500}}>{detailEx.muscle_group}</span>}
              {detailEx.equipment&&<span style={{fontSize:12,padding:'6px 14px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:20,color:'#999'}}>{detailEx.equipment}</span>}
            </div>
          </div>

          {/* Video */}
          {detailEx.video_url&&getYoutubeId(detailEx.video_url)&&<div style={{marginBottom:20,borderRadius:16,overflow:'hidden',aspectRatio:'16/9',border:'1px solid rgba(255,255,255,0.08)'}}><iframe src={'https://www.youtube.com/embed/'+getYoutubeId(detailEx.video_url)} style={{width:'100%',height:'100%',border:'none'}} allow="accelerometer; autoplay; encrypted-media; gyroscope" allowFullScreen/></div>}

          {/* Actions */}
          <div style={{display:'flex',gap:10}}>
            <button onClick={function(){
              var steps=[''];if(detailEx.description){steps=detailEx.description.split('\n').map(function(l){return l.replace(/^\d+\.\s*/,'')})}if(steps.length===0)steps=['']
              var cs=[];try{cs=detailEx.custom_sections?JSON.parse(detailEx.custom_sections):[]}catch(e){}
              setExForm(Object.assign({},detailEx,{tips:detailEx.tips||'',custom_sections:cs}));setTechSteps(steps);setEditingEx(detailEx.id);setDetailEx(null);setView('add-exercise')
            }} style={{flex:1,padding:'16px',background:GOLD,border:'none',borderRadius:14,color:'#000',fontSize:14,fontWeight:600,cursor:'pointer',fontFamily:'Outfit'}}>✏️ Modifier</button>
            <button onClick={function(){setDetailEx(null)}} style={{flex:1,padding:'16px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,color:'#999',fontSize:14,cursor:'pointer',fontFamily:'Outfit'}}>Fermer</button>
          </div>
        </div>
      </div>}

      {/* Long press menu */}
      {longMenu && <LongPressMenu show={true} title={longMenu.title} options={longMenu.options} onClose={function(){setLongMenu(null)}} />}

      {/* Onboarding guide */}
      {!coachMode && <OnboardingGuide storageKey="onboarding-programs" steps={[
        {emoji:'💪',title:'Bibliothèque d\'exercices',text:'Crée tes exercices avec GIF, technique d\'exécution et conseils. Ils seront disponibles dans tous tes programmes.'},
        {emoji:'📋',title:'Programmes multi-séances',text:'Compose des programmes avec plusieurs séances (A, B, C). Chaque séance peut avoir son propre mode : normal, circuit, tabata, AMRAP...'},
        {emoji:'📦',title:'Blocs réutilisables',text:'Sauvegarde un groupe d\'exercices comme bloc. Insère-le ensuite en un clic dans n\'importe quel programme.'},
        {emoji:'🔗',title:'Supersets',text:'Groupe 2-3 exercices en superset. Ils s\'enchaînent sans repos — le repos se prend après chaque tour complet.'},
        {emoji:'👤',title:'Assignation intelligente',text:'Quand tu assignes un programme à un client, une copie personnalisée est créée. Tu peux la modifier sans toucher au programme original.'},
        {emoji:'👆',title:'Gestes tactiles',text:'Glisse un élément vers la gauche pour accéder aux actions rapides. Appui long sur un programme pour plus d\'options.'}
      ]} />}

      {/* Live Training WorkoutPlayer overlay */}
      {liveWorkout && (
        <WorkoutPlayer
          program={{ id: null, name: liveWorkout.programName, program_exercises: liveWorkout.exercises, blocks: liveWorkout.blocks || [] }}
          profileId={liveWorkout.clientId || (profile && profile.id) || null}
          profileName={liveWorkout.clientId ? ((clients||[]).find(function(c){return c.id===liveWorkout.clientId})||{}).full_name||'' : 'Coach'}
          onClose={function(){
            var pName = progForm.name.trim()
            var clientName = liveWorkout.clientId ? ((clients||[]).find(function(c){return c.id===liveWorkout.clientId})||{}).full_name||'' : ''
            setLiveSaveModal({progName:pName||'Live Training',sessName:sessions[activeSession]?sessions[activeSession].name:'Séance 1',clientId:liveWorkout.clientId,clientName:clientName,exercises:liveWorkout.exercises})
            setLiveWorkout(false)
          }}
        />
      )}

      {/* Post-workout save modal */}
      {liveSaveModal && <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:20}}>
        <div style={{background:'var(--surface)',borderRadius:16,padding:24,maxWidth:400,width:'100%',border:'1px solid var(--border)'}}>
          <div style={{fontSize:16,fontWeight:600,marginBottom:8,fontFamily:'Outfit'}}>💾 Séance terminée !</div>
          <div style={{marginBottom:16}}>
            <input value={liveSaveModal.progName} onChange={function(e){setLiveSaveModal(function(s){return Object.assign({},s,{progName:e.target.value})})}} placeholder="Nom du programme" style={{...S.ip,marginBottom:6}} />
            <input value={liveSaveModal.sessName} onChange={function(e){setLiveSaveModal(function(s){return Object.assign({},s,{sessName:e.target.value})})}} placeholder="Nom de la séance" style={S.ip} />
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {liveSaveModal.clientId && <button onClick={async function(){
              var sm=liveSaveModal; if(!sm.progName.trim()){return}
              var {data:prog}=await supabase.from('programs').insert({name:sm.progName.trim(),coach_id:coachId}).select().single()
              if(prog){var {data:sess}=await supabase.from('program_sessions').insert({program_id:prog.id,name:sm.sessName.trim()||'Séance 1',order_index:0}).select().single()
              if(sess){await supabase.from('program_exercises').insert(sm.exercises.map(function(ex,i){return{session_id:sess.id,exercise_id:ex.exercise_id,sets:ex.sets||3,rep_min:ex.rep_min||8,rep_max:ex.rep_max||12,rep_mode:ex.rep_mode||'range',rest_seconds:ex.rest_seconds||90,order_index:i}}))}}
              setLiveSaveModal(false);loadAll()
            }} style={{padding:'12px 16px',background:GOLD,color:'#000',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Outfit'}}>💾 Sauvegarder et assigner à {liveSaveModal.clientName}</button>}
            <button onClick={async function(){
              var sm=liveSaveModal; if(!sm.progName.trim()){return}
              var {data:prog}=await supabase.from('programs').insert({name:sm.progName.trim(),coach_id:coachId}).select().single()
              if(prog){var {data:sess}=await supabase.from('program_sessions').insert({program_id:prog.id,name:sm.sessName.trim()||'Séance 1',order_index:0}).select().single()
              if(sess){await supabase.from('program_exercises').insert(sm.exercises.map(function(ex,i){return{session_id:sess.id,exercise_id:ex.exercise_id,sets:ex.sets||3,rep_min:ex.rep_min||8,rep_max:ex.rep_max||12,rep_mode:ex.rep_mode||'range',rest_seconds:ex.rest_seconds||90,order_index:i}}))}}
              setLiveSaveModal(false);loadAll()
            }} style={{padding:'12px 16px',background:'transparent',color:GOLD,border:'1px solid rgba(196,151,58,0.3)',borderRadius:10,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'Outfit'}}>📋 Sauvegarder comme template</button>
            <button onClick={function(){setLiveSaveModal(false)}} style={{padding:'12px 16px',background:'transparent',color:'#f87171',border:'1px solid rgba(248,113,113,0.3)',borderRadius:10,fontSize:13,cursor:'pointer',fontFamily:'Outfit'}}>🚪 Fermer sans sauvegarder</button>
          </div>
        </div>
      </div>}

      {/* Leave confirmation modal */}
      {leaveConfirm && <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:20}}>
        <div style={{background:'var(--surface)',borderRadius:16,padding:24,maxWidth:380,width:'100%',border:'1px solid var(--border)'}}>
          <div style={{fontSize:16,fontWeight:600,marginBottom:8,fontFamily:'Outfit'}}>⚠️ Quitter l'éditeur ?</div>
          <div style={{fontSize:13,color:'var(--muted)',marginBottom:20,lineHeight:1.5}}>Tu as des modifications non sauvegardées. Que veux-tu faire ?</div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <button onClick={async function(){await saveProgram();setLeaveConfirm(null)}} style={{padding:'12px 16px',background:GOLD,color:'#000',border:'none',borderRadius:10,fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'Outfit'}}>💾 Sauvegarder et quitter</button>
            <button onClick={function(){var dest=leaveConfirm;setLeaveConfirm(null);setProgForm({name:'',description:''});setSessions([]);setEditingProg(null);if(onEditingChange)onEditingChange(false);if(dest==='back'){onBack()}else{setView(dest)}}} style={{padding:'12px 16px',background:'transparent',color:'#f87171',border:'1px solid rgba(248,113,113,0.3)',borderRadius:10,fontSize:13,fontWeight:500,cursor:'pointer',fontFamily:'Outfit'}}>🚪 Quitter sans sauvegarder</button>
            <button onClick={function(){setLeaveConfirm(null)}} style={{padding:'12px 16px',background:'transparent',color:'var(--text)',border:'1px solid var(--border)',borderRadius:10,fontSize:13,cursor:'pointer',fontFamily:'Outfit'}}>← Continuer l'édition</button>
          </div>
        </div>
      </div>}

      {/* Zoom image overlay */}
      {zoomImg && <div onClick={function(){setZoomImg(null)}} style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.92)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>
        <img src={zoomImg} style={{maxWidth:'90%',maxHeight:'85vh',objectFit:'contain',borderRadius:12}} />
        <button onClick={function(){setZoomImg(null)}} style={{position:'absolute',top:16,right:16,background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',fontSize:20,width:40,height:40,borderRadius:20,cursor:'pointer'}}>✕</button>
      </div>}
    </div>
  )
}

var S={
  tl:{display:'flex',flexDirection:'column',alignItems:'center',gap:6,padding:'24px 14px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,cursor:'pointer',fontFamily:'Outfit',color:'var(--text)',width:'100%',transition:'all 0.2s',boxShadow:'var(--shadow)'},
  bt:{background:'#C4973A',color:'#000',border:'none',borderRadius:10,padding:'10px 18px',fontSize:12,fontWeight:500,cursor:'pointer',fontFamily:'Outfit',transition:'all 0.2s',boxShadow:'0 2px 8px rgba(196,151,58,0.25)'},
  bk:{background:'none',border:'none',color:'#7a7065',fontSize:11,cursor:'pointer',fontFamily:'Outfit',transition:'color 0.2s'},
  sm:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,padding:'3px 7px',cursor:'pointer',fontSize:11,fontFamily:'Outfit',color:'var(--text)',transition:'all 0.2s'},
  ip:{width:'100%',background:'var(--surface2)',border:'1px solid var(--border)',borderRadius:10,padding:'10px 12px',color:'var(--text)',fontSize:13,fontFamily:'Outfit',outline:'none',boxSizing:'border-box',transition:'border-color 0.2s'},
  lb:{fontSize:9,fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase',color:'var(--muted)',marginBottom:3},
  rw:{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,marginBottom:6,transition:'all 0.2s'},
}
