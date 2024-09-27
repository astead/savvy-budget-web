import React, { useState, useEffect } from 'react';
import { channels } from '../shared/constants.js';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faTrash, faEyeSlash } from "@fortawesome/free-solid-svg-icons"
import { DragDropContext, Draggable } from "react-beautiful-dnd"
import { StrictModeDroppable as Droppable } from '../helpers/StrictModeDroppable.js';
import NewCategory from '../helpers/NewCategory.tsx';
import { EditText } from 'react-edit-text';
import NewEnvelope from '../helpers/NewEnvelope.tsx';
import axios from 'axios';

export const ConfigCatEnv = () => {
 
  const [catData, setCatData] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load_cats_and_envs = async () => {
    const response = await axios.post('http://localhost:3001/api/' + channels.GET_CAT_ENV, {onlyActive: 0});

    // Receive the data
    const groupedData = categoryGroupBy(response.data, 'catID', 'category');
    const sortedData = Object.values(groupedData).sort(compareCategory);

    setCatData([...sortedData]);
    if (sortedData?.length) {
      setLoaded(true);
    }
  }

  const categoryGroupBy = (data, key, label) => {
    return data.reduce(function(acc, item) {
      let groupKey = item[key];
      let groupLabel = item[label];
      if (!acc[groupKey]) {
        acc[groupKey] = {catID:groupKey, cat:groupLabel, items:[]};
      }
      acc[groupKey].items.push(item);
      return acc;
    }, {});
  };

  const compareCategory = (a,b) => {
    if (a.cat === 'Uncategorized' || b.cat === 'Uncategorized') {
      if (a.cat === 'Uncategorized' && b.cat !== 'Uncategorized') {
        return -1;
      }
      if (a.cat !== 'Uncategorized' && b.cat === 'Uncategorized') {
        return 1;
      }
      return 0;
    } else if (a.cat === 'Income' || b.cat === 'Income') {
      if (a.cat === 'Income' && b.cat !== 'Income') {
        return -1;
      }
      if (a.cat !== 'Income' && b.cat === 'Income') {
        return 1;
      }
      return 0;
    } else {
      if (a.cat < b.cat) {
        return -1;
      }
      if (a.cat > b.cat) {
        return 1;
      }
      return 0;
    }
  }

  const handleCategoryDelete = async (id, name) => {
    // Don't allow deleting of Income or Uncategorized
    if (name === 'Income') {
      return;
    }
    if (name === 'Uncategorized') {
      return;
    }

    // Request we delete the category in the DB
    await axios.post('http://localhost:3001/api/' + channels.DEL_CATEGORY, { id });
    load_cats_and_envs();
  };

  const handleNewCategory = () => {
    load_cats_and_envs();
  };

  const handleNewEnvelope = () => {
    load_cats_and_envs();
  };

  const handleEnvelopeDelete = async (id) => {
    // Request we delete the category in the DB
    await axios.post('http://localhost:3001/api/' + channels.DEL_ENVELOPE, { id });
    load_cats_and_envs();
  };

  const handleEnvelopeHide = async (id) => {
    // Request we delete the category in the DB
    await axios.post('http://localhost:3001/api/' + channels.HIDE_ENVELOPE, { id });
    load_cats_and_envs();
  };

  const handleOnDragEnd = (result) => {
    if (!result?.destination) return;
    
    const envID = parseInt(result.draggableId);
    const oldCatID = parseInt(result.source.droppableId);
    const newCatID = parseInt(result.destination.droppableId);

    if (oldCatID !== newCatID) {
      
      // Request we move the envelope in the DB
      const ipcRenderer = (window as any).ipcRenderer;
      ipcRenderer.send(channels.MOV_ENVELOPE,  { id: envID, newCatID: newCatID } );

      // Move these around in the arrays (or for pull from DB after this is done)
      const oldCatNode = catData.find((i) => i.catID === oldCatID);
      const newCatNode = catData.find((i) => i.catID === newCatID);
      const oldIndex = oldCatNode.items.indexOf((item) => item.envID === envID);
      const myNode = oldCatNode.items.splice(oldIndex, 1).pop();
      newCatNode.items.push({...myNode, catID: newCatID, category: newCatNode.cat });

      setCatData([...catData]);
    }
  };

  const handleCatOnSave = (id, value) => {
    let tmpName = value;

    if (tmpName === 'Income') {
      tmpName = 'Income 2'; 
    }
    if (tmpName === 'Uncategorized') {
      tmpName = 'Uncategorized 2';
    }

    // Request we rename the category in the DB
    const ipcRenderer = (window as any).ipcRenderer;
    ipcRenderer.send(channels.REN_CATEGORY, { id: id, name: tmpName });
    
    if (tmpName !== value) {
      // Wait till we are done
      ipcRenderer.on(channels.DONE_REN_CATEGORY, () => {
        load_cats_and_envs();
        ipcRenderer.removeAllListeners(channels.DONE_REN_CATEGORY);
      });
      
      // Clean the listener after the component is dismounted
      return () => {
        ipcRenderer.removeAllListeners(channels.DONE_REN_CATEGORY);
      };
    }
  }

  useEffect(() => {
    if (!loaded) {
      load_cats_and_envs();
    }
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) {
    return (<></>);
  }

  return (
    <>
    <NewCategory callback={handleNewCategory} />
    <DragDropContext onDragEnd={handleOnDragEnd}>
      {catData.map((category, index) => {
        const { catID, cat:cat_name, items } = category;
        
        return (
          <Droppable droppableId={catID.toString()} key={"cat-" + cat_name}>
            {(provided) => (
              <section  {...provided.droppableProps} ref={provided.innerRef}>
                <article className="cat">
                  <article
                    className={
                      cat_name === 'Income'?'cat ci ci-income':
                      cat_name === 'Uncategorized'?'cat ci ci-uncategorized':'cat ci'}>
                    <div className="cat">
                      {(cat_name === 'Income' || cat_name === 'Uncategorized')?
                        <div className="cat">{cat_name}</div>
                        :
                        <EditText
                          key={"cat-" + catID.toString() + "-" + cat_name}  
                          name={"cat-" + catID.toString()}
                          defaultValue={cat_name}
                          onSave={({name, value, previousValue}) => {
                            handleCatOnSave(catID, value);
                          }}
                          style={{}}
                          className={"cat"}
                          inputClassName={""}
                        />
                      }
                    </div>
                    <NewEnvelope id={catID} callback={handleNewEnvelope} />
                    {(cat_name !== 'Income' && cat_name !== 'Uncategorized')?
                      <button 
                        className="trash"
                        onClick={() => handleCategoryDelete( catID, cat_name )}>
                          <FontAwesomeIcon icon={faTrash} />
                      </button>
                      :''
                    }
                  </article>
                  
                  <article className="cat env">
                  {
                    items.map((env, index2) => {
                      return (
                        (env.envID) &&
                        <Draggable key={"env" + env.envID} draggableId={env.envID.toString()} index={index2}>
                          {(provided) => (
                            <article className="cat env ei-container" {...provided.draggableProps} {...provided.dragHandleProps} ref={provided.innerRef}>
                              <article className="cat env ei-container ei">
                                <div className="cat">
                                  <EditText
                                    name={env.envID.toString()}
                                    defaultValue={env.envelope}
                                    onSave={({name, value, previousValue}) => {
                                      // Request we rename the envelope in the DB
                                      const ipcRenderer = (window as any).ipcRenderer;
                                      ipcRenderer.send(channels.REN_ENVELOPE, { id: env.envID, name: value });
                                    }}
                                    style={{}}
                                    className={"cat"}
                                    inputClassName={""}
                                  />
                                </div>
                                <button onClick={() => handleEnvelopeHide( env.envID )}
                                  className={"Toggle" + (!env.isActive?" Toggle-active":"")}>
                                  <FontAwesomeIcon icon={faEyeSlash} />
                                </button>
                                <button className="trash" onClick={() => handleEnvelopeDelete( env.envID )}>
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                              </article>
                            </article>
                        )}
                        </Draggable>
                      )
                    })
                  }
                  </article>
                </article>
                { provided.placeholder }
              </section>
            )}
          </Droppable>
        );
      })}   
    </DragDropContext>
    </>
  );
};


export default ConfigCatEnv;