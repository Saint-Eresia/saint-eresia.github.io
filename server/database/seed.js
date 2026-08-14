const bcrypt = require('bcrypt');
const { pool } = require('../config/database');
const { novels, patches } = require('../data/demo-data');

async function run() {
  if (!pool) throw new Error('DATABASE_URL est obligatoire pour charger les données.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const adminHash = await bcrypt.hash('AdminEresia!2026', 12);
    const userHash = await bcrypt.hash('LecteurEresia!2026', 12);
    const admin = await client.query(`INSERT INTO users(email,username,display_name,password_hash,role,email_verified_at) VALUES($1,$2,$3,$4,'ADMIN',now()) ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id`, ['admin@saint-eresia.local','eresia-admin','Admin Eresia',adminHash]);
    const reader = await client.query(`INSERT INTO users(email,username,display_name,password_hash,role,email_verified_at) VALUES($1,$2,$3,$4,'USER',now()) ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id`, ['lecteur@saint-eresia.local','lecteur-demo','Lecteur Démo',userHash]);
    const adminId=admin.rows[0].id, readerId=reader.rows[0].id;
    for(const name of ['Fantasy','Romance','Aventure','Mystère','Drame','Science-fiction','Fantastique','Psychologique','Action']) await client.query(`INSERT INTO genres(slug,name) VALUES(lower(regexp_replace($1,'[^a-zA-Z0-9]+','-','g')),$1) ON CONFLICT(name) DO NOTHING`,[name]);
    for(const item of novels){
      const result=await client.query(`INSERT INTO novels(slug,title,original_title,type,cover_url,synopsis,author,artist,translator,original_language,translation_language,work_status,translation_status,published_at,last_updated_at,volume_count,chapter_count,average_rating,rating_count,views,favorites_count,content_warnings,meta_title,meta_description,publication_status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,'published',$25) ON CONFLICT(slug) DO UPDATE SET title=EXCLUDED.title RETURNING id`,[item.slug,item.title,item.originalTitle,item.type,item.cover,item.synopsis,item.author,item.artist,item.translator,item.originalLanguage,item.translationLanguage,item.workStatus,item.translationStatus,item.publishedAt,item.updatedAt,item.volumeCount,item.chapterCount,item.rating,item.ratingsCount,item.views,item.favorites,item.warnings,`${item.title} — Saint Eresia`,item.synopsis.slice(0,300),adminId]);
      const novelId=result.rows[0].id;
      for(const alt of item.alternativeTitles)await client.query('INSERT INTO novel_alternative_titles(novel_id,title) VALUES($1,$2) ON CONFLICT DO NOTHING',[novelId,alt]);
      for(const volume of item.volumes){
        const vr=await client.query(`INSERT INTO volumes(novel_id,number,title,slug,summary,sort_order,published_at) VALUES($1,$2,$3,$4,$5,$6,now()) ON CONFLICT(novel_id,slug) DO UPDATE SET title=EXCLUDED.title RETURNING id`,[novelId,volume.number,volume.title,`${item.slug}-${volume.slug}`,volume.summary,volume.number]);
        for(const chapter of volume.chapters)await client.query(`INSERT INTO chapters(volume_id,title,slug,number,sort_order,content_html,status,published_at,word_count,estimated_reading_minutes,created_by) VALUES($1,$2,$3,$4,$5,$6,'Publié',$7,$8,$9,$10) ON CONFLICT(slug) DO NOTHING`,[vr.rows[0].id,chapter.title,`${item.slug}-${chapter.slug}`,chapter.number,chapter.number,chapter.content,chapter.publishedAt,chapter.wordCount,chapter.readingTime,adminId]);
      }
    }
    for(const item of patches){
      const result=await client.query(`INSERT INTO patches(slug,title,alternative_titles,vndb_id,vndb_url,cover_url,game_synopsis,developer,publisher,engine,platform,compatible_systems,compatible_game_version,original_language,patch_language,translation_team,patch_type,status,progress,current_version,last_updated_at,requirements,warnings,downloads_count,average_rating,publication_status,rights_confirmed_by,rights_confirmed_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,'published',$26,now(),$26) ON CONFLICT(slug) DO UPDATE SET current_version=EXCLUDED.current_version RETURNING id`,[item.slug,item.title,item.alternativeTitles,item.vndbId,item.vndbUrl,item.cover,item.synopsis,item.developer,item.publisher,item.engine,item.platform,item.systems,item.gameVersion,item.originalLanguage,item.patchLanguage,item.team,item.type,item.status,item.progress,item.currentVersion,item.updatedAt,item.requirements.join('\n'),item.warnings.join('\n'),item.downloads,item.rating,adminId]);
      for(const version of item.versions)await client.query(`INSERT INTO patch_versions(patch_id,version,file_storage_key,file_size,mime_type,checksum_sha256,game_version,changelog,status,released_at) VALUES($1,$2,$3,$4,'application/zip',$5,$6,$7,'active',$8) ON CONFLICT(patch_id,version) DO NOTHING`,[result.rows[0].id,version.version,`demo/${item.slug}-${version.version}.zip`,(180+item.id*42)*1024*1024,item.checksum.padEnd(64,'0').slice(0,64),item.gameVersion,item.changelog.join('\n'),version.releasedAt]);
    }
    const firstNovel=await client.query('SELECT id FROM novels ORDER BY id LIMIT 1');
    const firstChapter=await client.query('SELECT id FROM chapters ORDER BY id LIMIT 1');
    const firstPatch=await client.query('SELECT id FROM patches ORDER BY id LIMIT 1');
    await client.query(`INSERT INTO favorites(user_id,novel_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[readerId,firstNovel.rows[0].id]);
    await client.query(`INSERT INTO favorites(user_id,patch_id) VALUES($1,$2) ON CONFLICT DO NOTHING`,[readerId,firstPatch.rows[0].id]);
    await client.query(`INSERT INTO reading_list(user_id,novel_id,category) VALUES($1,$2,'En cours') ON CONFLICT(user_id,novel_id) DO NOTHING`,[readerId,firstNovel.rows[0].id]);
    await client.query(`INSERT INTO reading_progress(user_id,novel_id,chapter_id,progress_percent,scroll_position) VALUES($1,$2,$3,42,1100) ON CONFLICT(user_id,novel_id) DO UPDATE SET progress_percent=42`,[readerId,firstNovel.rows[0].id,firstChapter.rows[0].id]);
    await client.query('COMMIT'); console.log('Données de démonstration Saint Eresia chargées.');
  } catch(error){await client.query('ROLLBACK');throw error;} finally{client.release();await pool.end();}
}
run().catch((error)=>{console.error(error);process.exitCode=1;});
