-- Mapeamento manual: tanques_postos.posto_nome → postos.nome (razão social)
-- Executa um UPDATE por par conhecido

UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'AUTO POSTO INDEPENDENCIA LTDA EPP'   LIMIT 1) WHERE posto_nome = 'INDEPENDÊNCIA';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'AUTO POSTO CASTELAO LTDA'             LIMIT 1) WHERE posto_nome = 'CASTELÃO';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'AUTO POSTO CENTER LTDA'               LIMIT 1) WHERE posto_nome = 'CENTER';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'AUTO POSTO CENTRAL LTDA'              LIMIT 1) WHERE posto_nome = 'CENTRAL';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'AUTO POSTO IMPERIAL LTDA ME'          LIMIT 1) WHERE posto_nome = 'POSTO IMPERIAL';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'AUTO POSTO REAL LTDA'                 LIMIT 1) WHERE posto_nome = 'POSTO REAL';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'AUTO POSTO SENNA LTDA'                LIMIT 1) WHERE posto_nome = 'SENNA';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'AUTO POSTO PEDRA DO POMBAL LTDA'      LIMIT 1) WHERE posto_nome = 'POMBAL';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'BELA VISTA COMERCIO DE COMBUSTIVEIS'  LIMIT 1) WHERE posto_nome = 'BELA VISTA';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'CASTELO COMERCIO DE COMBUSTIVEIS LTDA' LIMIT 1) WHERE posto_nome = 'CASTELO';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'ESTACAO COMERCIO DE COMBUSTIVEL LTDA' LIMIT 1) WHERE posto_nome = 'POSTO ESTAÇÃO';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'FAITH POSTO DE COMBUSTIVEL LTDA'      LIMIT 1) WHERE posto_nome = 'POSTO FIATH';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'FORTALEZA COMERCIO DE COMBUSTIVELS LTDA EPP' LIMIT 1) WHERE posto_nome = 'FORTALEZA';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'POMBAL ITABAPOANA COMERCIO DE COMBUSTIVEIS LTDA' LIMIT 1) WHERE posto_nome = 'POMBAL ITABAPOANA';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'POSTO ALTEROSA LTDA'                  LIMIT 1) WHERE posto_nome = 'ALTEROSA';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'POSTO CASTELINHO LTDA'                LIMIT 1) WHERE posto_nome = 'POSTO CASTELINHO';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'POSTO DO KIN CAMPOS LTDA'             LIMIT 1) WHERE posto_nome = 'POSTO DO KIN';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'POSTO SAGRADO LTDA'                   LIMIT 1) WHERE posto_nome = 'SAGRADO';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'POSTO SAO CRISTOVAO DE CASTELO LTDA'  LIMIT 1) WHERE posto_nome = 'SÃO CRISTOVÃO';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'POSTO SETE IRMAOS LTDA ME'            LIMIT 1) WHERE posto_nome = '7 IRMÃOS';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'SANTA RITA COMERCIO DE COMBUSTIVEIS LTDA' LIMIT 1) WHERE posto_nome = 'SANTA RITA';
UPDATE tanques_postos SET posto_id = (SELECT id FROM postos WHERE nome = 'SUDESTE COMERCIO DE COMBUSTIVEIS LTDA' LIMIT 1) WHERE posto_nome = 'SUDESTE';

-- Verificar quais ainda ficaram sem vínculo (NULL):
-- SELECT posto_nome, posto_id FROM tanques_postos WHERE posto_id IS NULL GROUP BY posto_nome, posto_id ORDER BY posto_nome;
